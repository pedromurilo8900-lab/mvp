"""Calen Health backend — FastAPI + MongoDB.

Handles: email/password auth (bcrypt + JWT), patient/medication/appointment CRUD,
dynamic calendar event generation (recurrence for medications), health
measurements, symptoms, fall-risk assessments, adherence tracking,
notifications, and Emergent-managed push registration/relay.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("calen")

app = FastAPI(title="Calen Health API")
api = APIRouter(prefix="/api")

_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

ActorType = Literal["patient", "caregiver", "professional"]


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str
    birth_date: Optional[str] = None  # ISO date


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class Medication(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    name: str
    dosage: str  # e.g. "50"
    unit: str = "mg"
    route: str = "Via oral"
    presentation: Optional[str] = None
    instructions: Optional[str] = None
    frequency_type: Literal["daily", "specific_days", "interval"] = "daily"
    days_of_week: list[int] = Field(default_factory=list)  # 0=Mon
    interval_hours: Optional[int] = None
    times: list[str] = Field(default_factory=list)  # "HH:MM"
    start_date: str  # ISO date
    end_date: Optional[str] = None
    continuous_use: bool = True
    status: Literal["active", "paused", "ended"] = "active"
    prescriber: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))
    updated_at: str = Field(default_factory=lambda: iso(now_utc()))


class Appointment(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    specialty: str
    professional: str
    date: str  # ISO date
    time: str  # HH:MM
    location: Optional[str] = None
    kind: Literal["consultation", "return"] = "consultation"
    notes: Optional[str] = None
    status: Literal["scheduled", "done", "cancelled"] = "scheduled"
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class Exam(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    name: str
    date: str
    time: Optional[str] = None
    location: Optional[str] = None
    status: Literal["scheduled", "done", "cancelled"] = "scheduled"
    result_note: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class Vaccine(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    name: str
    date: str
    time: Optional[str] = None
    location: Optional[str] = None
    status: Literal["scheduled", "done", "cancelled"] = "scheduled"
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class HealthMeasurement(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    kind: Literal["weight", "blood_pressure", "glucose", "abdominal", "height", "imc"]
    value: dict  # e.g. {"weight":72.4} or {"systolic":120,"diastolic":80}
    unit: str
    context: Optional[str] = None  # for glucose: fasting/before_meal/etc
    recorded_at: str  # ISO datetime
    actor_type: ActorType = "patient"
    actor_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class SymptomRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    text: str
    tags: list[str] = Field(default_factory=list)
    intensity: Optional[int] = None  # 1-10
    recorded_at: str
    actor_type: ActorType = "patient"
    actor_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class FallRiskAssessment(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    level: Literal["low", "moderate", "high"]
    instrument: Optional[str] = None  # future scale name
    score: Optional[float] = None
    date: str  # ISO date
    actor_type: ActorType = "professional"
    actor_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: iso(now_utc()))


class DoseMarkBody(BaseModel):
    scheduled_at: str  # ISO datetime — unique dose slot key
    medication_id: str
    status: Literal["taken", "not_taken", "pending"]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@api.post("/auth/register")
async def auth_register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")
    user_id = new_id()
    patient_id = new_id()
    user_doc = {
        "id": user_id,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "name": body.name,
        "birth_date": body.birth_date,
        "patient_id": patient_id,
        "role": "patient",
        "created_at": iso(now_utc()),
    }
    patient_doc = {
        "id": patient_id,
        "user_id": user_id,
        "name": body.name,
        "birth_date": body.birth_date,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    await db.patients.insert_one(patient_doc)
    token = make_token(user_id)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"token": token, "user": user_doc}


@api.post("/auth/login")
async def auth_login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "E-mail ou senha inválidos")
    token = make_token(user["id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def auth_me(user=Depends(current_user)):
    return user


# ---------------------------------------------------------------------------
# Push notifications relay (Emergent managed)
# ---------------------------------------------------------------------------

class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"register-push failed: {e}")
    return {"status": "registered"}


async def send_push(recipients: list[str], data: dict, idempotency_key: str | None = None) -> None:
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        resp = await _push_client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code >= 400:
            logger.warning(f"send_push non-2xx: {resp.status_code}")
    except Exception as e:
        logger.warning(f"send_push failed: {e}")


# ---------------------------------------------------------------------------
# Medications CRUD
# ---------------------------------------------------------------------------

@api.get("/medications")
async def list_medications(user=Depends(current_user)):
    meds = await db.medications.find({"patient_id": user["patient_id"]}, {"_id": 0}).to_list(500)
    return meds


@api.post("/medications")
async def create_medication(med: Medication, user=Depends(current_user)):
    med.patient_id = user["patient_id"]
    doc = med.model_dump()
    await db.medications.insert_one(doc.copy())
    return doc


# NOTE: /medications/{med_id} routes are declared after /medications/doses/*
# and /medications/adherence below to avoid path collision with FastAPI.


# ---------------------------------------------------------------------------
# Calendar event generation (dynamic recurrence)
# ---------------------------------------------------------------------------

def _parse_date(s: str) -> date:
    return date.fromisoformat(s[:10])


def _parse_time(s: str) -> time:
    hh, mm = s.split(":")
    return time(int(hh), int(mm))


def _med_occurrences(med: dict, day: date) -> list[str]:
    """Return list of HH:MM times a medication should be taken on `day`."""
    if med.get("status") != "active":
        return []
    start = _parse_date(med["start_date"])
    if day < start:
        return []
    end = med.get("end_date")
    if not med.get("continuous_use") and end and day > _parse_date(end):
        return []
    ftype = med.get("frequency_type", "daily")
    if ftype == "daily":
        return sorted(med.get("times", []))
    if ftype == "specific_days":
        weekday = day.weekday()
        if weekday not in (med.get("days_of_week") or []):
            return []
        return sorted(med.get("times", []))
    if ftype == "interval":
        # simple: use provided times
        return sorted(med.get("times", []))
    return []


async def _calendar_events_for_range(
    patient_id: str, start: date, end: date
) -> list[dict]:
    """Generate events for a date range from medications + appointments + exams + vaccines.

    Doses statuses come from `medication_doses` (keyed by medication_id + scheduled_at ISO).
    """
    events: list[dict] = []

    # medications
    meds = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(500)
    dose_records = await db.medication_doses.find(
        {"patient_id": patient_id}, {"_id": 0}
    ).to_list(20000)
    dose_map = {(d["medication_id"], d["scheduled_at"]): d for d in dose_records}

    day = start
    while day <= end:
        for m in meds:
            for t in _med_occurrences(m, day):
                dt = datetime.combine(day, _parse_time(t), tzinfo=timezone.utc)
                key = (m["id"], iso(dt))
                dose = dose_map.get(key)
                events.append({
                    "id": f"med:{m['id']}:{iso(dt)}",
                    "type": "medication",
                    "title": m["name"],
                    "subtitle": f"{m['dosage']} {m.get('unit', '')} · {m.get('route', '')}",
                    "date": day.isoformat(),
                    "time": t,
                    "scheduled_at": iso(dt),
                    "source_id": m["id"],
                    "status": dose.get("status") if dose else "pending",
                    "recorded_at": dose.get("recorded_at") if dose else None,
                    "metadata": {
                        "dosage": m["dosage"],
                        "unit": m.get("unit"),
                        "route": m.get("route"),
                    },
                })
        day += timedelta(days=1)

    # appointments
    appts = await db.appointments.find(
        {"patient_id": patient_id, "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0},
    ).to_list(500)
    for a in appts:
        events.append({
            "id": f"appt:{a['id']}",
            "type": "appointment",
            "title": a["specialty"],
            "subtitle": a.get("professional", ""),
            "date": a["date"],
            "time": a.get("time"),
            "scheduled_at": a["date"] + "T" + (a.get("time") or "00:00") + ":00+00:00",
            "source_id": a["id"],
            "status": a.get("status", "scheduled"),
            "metadata": {"location": a.get("location"), "professional": a.get("professional")},
        })

    # exams
    exams = await db.exams.find(
        {"patient_id": patient_id, "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0},
    ).to_list(500)
    for e in exams:
        events.append({
            "id": f"exam:{e['id']}",
            "type": "exam",
            "title": e["name"],
            "subtitle": "Exame",
            "date": e["date"],
            "time": e.get("time"),
            "scheduled_at": e["date"] + "T" + (e.get("time") or "00:00") + ":00+00:00",
            "source_id": e["id"],
            "status": e.get("status", "scheduled"),
            "metadata": {"location": e.get("location")},
        })

    # vaccines
    vacs = await db.vaccines.find(
        {"patient_id": patient_id, "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0},
    ).to_list(500)
    for v in vacs:
        events.append({
            "id": f"vac:{v['id']}",
            "type": "vaccine",
            "title": v["name"],
            "subtitle": "Vacina",
            "date": v["date"],
            "time": v.get("time"),
            "scheduled_at": v["date"] + "T" + (v.get("time") or "00:00") + ":00+00:00",
            "source_id": v["id"],
            "status": v.get("status", "scheduled"),
            "metadata": {"location": v.get("location")},
        })

    events.sort(key=lambda x: (x["date"], x.get("time") or "00:00"))
    return events


@api.get("/calendar/events")
async def calendar_events(start: str, end: str, user=Depends(current_user)):
    s, e = _parse_date(start), _parse_date(end)
    if (e - s).days > 62:
        raise HTTPException(400, "Range too large (max 62 days)")
    return await _calendar_events_for_range(user["patient_id"], s, e)


# ---------------------------------------------------------------------------
# Medication doses / adherence
# ---------------------------------------------------------------------------

@api.get("/medications/doses/today")
async def doses_today(user=Depends(current_user)):
    today = date.today()
    events = await _calendar_events_for_range(user["patient_id"], today, today)
    return [e for e in events if e["type"] == "medication"]


@api.post("/medications/doses/mark")
async def mark_dose(body: DoseMarkBody, user=Depends(current_user)):
    med = await db.medications.find_one(
        {"id": body.medication_id, "patient_id": user["patient_id"]}, {"_id": 0}
    )
    if not med:
        raise HTTPException(404, "Medicamento não encontrado")
    doc = {
        "id": new_id(),
        "patient_id": user["patient_id"],
        "medication_id": body.medication_id,
        "scheduled_at": body.scheduled_at,
        "status": body.status,
        "recorded_at": iso(now_utc()),
        "recorded_by": user["id"],
        "actor_type": "patient",
        "actor_name": user.get("name"),
    }
    await db.medication_doses.update_one(
        {"medication_id": body.medication_id, "scheduled_at": body.scheduled_at, "patient_id": user["patient_id"]},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "dose": doc}


@api.get("/medications/adherence")
async def adherence(days: int = 30, user=Depends(current_user)):
    end = date.today()
    start = end - timedelta(days=days - 1)
    events = await _calendar_events_for_range(user["patient_id"], start, end)
    med_events = [e for e in events if e["type"] == "medication"]
    taken = sum(1 for e in med_events if e["status"] == "taken")
    total = len(med_events)
    pct = round((taken / total) * 100) if total else 0
    # per-day breakdown
    per_day: dict[str, dict] = {}
    for e in med_events:
        d = e["date"]
        b = per_day.setdefault(d, {"date": d, "total": 0, "taken": 0, "not_taken": 0, "pending": 0})
        b["total"] += 1
        b[e["status"]] = b.get(e["status"], 0) + 1
    return {"days": days, "total": total, "taken": taken, "percentage": pct, "per_day": list(per_day.values())}


@api.get("/medications/{med_id}")
async def get_medication(med_id: str, user=Depends(current_user)):
    med = await db.medications.find_one({"id": med_id, "patient_id": user["patient_id"]}, {"_id": 0})
    if not med:
        raise HTTPException(404, "Medicamento não encontrado")
    return med


@api.patch("/medications/{med_id}")
async def update_medication(med_id: str, patch: dict, user=Depends(current_user)):
    patch["updated_at"] = iso(now_utc())
    res = await db.medications.update_one(
        {"id": med_id, "patient_id": user["patient_id"]}, {"$set": patch}
    )
    if not res.matched_count:
        raise HTTPException(404, "Medicamento não encontrado")
    med = await db.medications.find_one({"id": med_id}, {"_id": 0})
    return med


# ---------------------------------------------------------------------------
# Appointments / Exams / Vaccines
# ---------------------------------------------------------------------------

@api.get("/appointments")
async def list_appts(user=Depends(current_user)):
    return await db.appointments.find({"patient_id": user["patient_id"]}, {"_id": 0}).to_list(200)


@api.post("/appointments")
async def create_appt(body: Appointment, user=Depends(current_user)):
    body.patient_id = user["patient_id"]
    doc = body.model_dump()
    await db.appointments.insert_one(doc.copy())
    return doc


@api.get("/exams")
async def list_exams(user=Depends(current_user)):
    return await db.exams.find({"patient_id": user["patient_id"]}, {"_id": 0}).to_list(200)


@api.get("/vaccines")
async def list_vaccines(user=Depends(current_user)):
    return await db.vaccines.find({"patient_id": user["patient_id"]}, {"_id": 0}).to_list(200)


# ---------------------------------------------------------------------------
# Measurements / Symptoms / Fall risk
# ---------------------------------------------------------------------------

@api.get("/measurements")
async def list_measurements(kind: Optional[str] = None, user=Depends(current_user)):
    q = {"patient_id": user["patient_id"]}
    if kind:
        q["kind"] = kind
    return await db.measurements.find(q, {"_id": 0}).sort("recorded_at", -1).to_list(2000)


@api.post("/measurements")
async def create_measurement(m: HealthMeasurement, user=Depends(current_user)):
    m.patient_id = user["patient_id"]
    m.actor_type = "patient"
    m.actor_name = user.get("name")
    # auto-IMC if weight & height available
    doc = m.model_dump()
    await db.measurements.insert_one(doc.copy())
    if m.kind == "weight":
        # try to compute IMC using latest height
        h = await db.measurements.find_one(
            {"patient_id": user["patient_id"], "kind": "height"}, sort=[("recorded_at", -1)], projection={"_id": 0}
        )
        if h:
            hv = float(h["value"].get("height", 0)) / 100.0
            wv = float(m.value.get("weight", 0))
            if hv > 0 and wv > 0:
                imc = round(wv / (hv * hv), 1)
                imc_doc = HealthMeasurement(
                    patient_id=user["patient_id"], kind="imc",
                    value={"imc": imc, "auto": True}, unit="kg/m²",
                    recorded_at=m.recorded_at, actor_type="patient", actor_name=user.get("name"),
                ).model_dump()
                await db.measurements.insert_one(imc_doc.copy())
    return doc


@api.get("/symptoms")
async def list_symptoms(user=Depends(current_user)):
    return await db.symptoms.find({"patient_id": user["patient_id"]}, {"_id": 0}).sort("recorded_at", -1).to_list(500)


@api.post("/symptoms")
async def create_symptom(s: SymptomRecord, user=Depends(current_user)):
    s.patient_id = user["patient_id"]
    s.actor_type = "patient"
    s.actor_name = user.get("name")
    doc = s.model_dump()
    await db.symptoms.insert_one(doc.copy())
    return doc


@api.get("/fall-risk")
async def list_fall_risk(user=Depends(current_user)):
    return await db.fall_risk.find({"patient_id": user["patient_id"]}, {"_id": 0}).sort("date", -1).to_list(200)


@api.post("/fall-risk")
async def create_fall_risk(a: FallRiskAssessment, user=Depends(current_user)):
    a.patient_id = user["patient_id"]
    doc = a.model_dump()
    await db.fall_risk.insert_one(doc.copy())
    return doc


# ---------------------------------------------------------------------------
# Home summary
# ---------------------------------------------------------------------------

@api.get("/home/summary")
async def home_summary(user=Depends(current_user)):
    pid = user["patient_id"]
    today = date.today()
    events = await _calendar_events_for_range(pid, today, today + timedelta(days=14))
    med_today = [e for e in events if e["type"] == "medication" and e["date"] == today.isoformat()]
    taken = sum(1 for e in med_today if e["status"] == "taken")
    total = len(med_today)

    next_appt = next((e for e in events if e["type"] == "appointment"), None)
    next_exam_or_vac = next((e for e in events if e["type"] in ("exam", "vaccine")), None)
    # next medication (pending)
    now_key = iso(now_utc())
    next_med = next(
        (e for e in events if e["type"] == "medication" and e["status"] == "pending" and e["scheduled_at"] >= now_key),
        None,
    ) or (med_today[0] if med_today else None)

    latest_measurements = (
        await db.measurements.find({"patient_id": pid}, {"_id": 0}).sort("recorded_at", -1).to_list(3)
    )
    fall_risk = await db.fall_risk.find_one({"patient_id": pid}, sort=[("date", -1)], projection={"_id": 0})

    unread_notifs = await db.notifications.count_documents({"patient_id": pid, "read": False})

    return {
        "date": today.isoformat(),
        "next": {
            "appointment": next_appt,
            "medication": next_med,
            "exam_or_vaccine": next_exam_or_vac,
        },
        "day_summary": {
            "medications": {"taken": taken, "total": total},
            "next_appointment": next_appt,
            "fall_risk": fall_risk,
        },
        "latest_measurements": latest_measurements,
        "unread_notifications": unread_notifs,
    }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    return await db.notifications.find({"patient_id": user["patient_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/notifications/mark-read")
async def mark_read(body: dict, user=Depends(current_user)):
    ids = body.get("ids", [])
    q = {"patient_id": user["patient_id"]}
    if ids:
        q["id"] = {"$in": ids}
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Demo seed — João Silva (idempotent)
# ---------------------------------------------------------------------------

DEMO_EMAIL = "joao.silva@calenhealth.demo"
DEMO_PASSWORD = "calen2026"


@api.post("/seed/demo")
async def seed_demo():
    existing = await db.users.find_one({"email": DEMO_EMAIL})
    if existing:
        # wipe patient data but keep user/patient IDs
        pid = existing["patient_id"]
        await db.medications.delete_many({"patient_id": pid})
        await db.appointments.delete_many({"patient_id": pid})
        await db.exams.delete_many({"patient_id": pid})
        await db.vaccines.delete_many({"patient_id": pid})
        await db.measurements.delete_many({"patient_id": pid})
        await db.symptoms.delete_many({"patient_id": pid})
        await db.fall_risk.delete_many({"patient_id": pid})
        await db.medication_doses.delete_many({"patient_id": pid})
        await db.notifications.delete_many({"patient_id": pid})
        user_id = existing["id"]
        patient_id = pid
    else:
        user_id = new_id()
        patient_id = new_id()
        await db.users.insert_one({
            "id": user_id,
            "email": DEMO_EMAIL,
            "password_hash": hash_password(DEMO_PASSWORD),
            "name": "João Silva",
            "birth_date": "1952-05-14",
            "patient_id": patient_id,
            "role": "patient",
            "created_at": iso(now_utc()),
        })
        await db.patients.insert_one({
            "id": patient_id,
            "user_id": user_id,
            "name": "João Silva",
            "birth_date": "1952-05-14",
            "created_at": iso(now_utc()),
        })

    today = date.today()

    # Medications
    meds = [
        {
            "id": new_id(), "patient_id": patient_id, "name": "Losartana", "dosage": "50", "unit": "mg",
            "route": "Via oral", "presentation": "Comprimido", "instructions": "Tomar em jejum",
            "frequency_type": "daily", "days_of_week": [], "interval_hours": None,
            "times": ["08:00"], "start_date": (today - timedelta(days=180)).isoformat(),
            "end_date": None, "continuous_use": True, "status": "active",
            "prescriber": "Dra. Ana Souza", "notes": None,
            "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
        },
        {
            "id": new_id(), "patient_id": patient_id, "name": "Metformina", "dosage": "500", "unit": "mg",
            "route": "Via oral", "presentation": "Comprimido", "instructions": "Após as refeições",
            "frequency_type": "daily", "days_of_week": [], "interval_hours": None,
            "times": ["08:00", "20:00"], "start_date": (today - timedelta(days=120)).isoformat(),
            "end_date": None, "continuous_use": True, "status": "active",
            "prescriber": "Dr. Carlos Lima", "notes": None,
            "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
        },
        {
            "id": new_id(), "patient_id": patient_id, "name": "Sinvastatina", "dosage": "20", "unit": "mg",
            "route": "Via oral", "presentation": "Comprimido", "instructions": "Tomar à noite",
            "frequency_type": "daily", "days_of_week": [], "interval_hours": None,
            "times": ["22:00"], "start_date": (today - timedelta(days=90)).isoformat(),
            "end_date": None, "continuous_use": True, "status": "active",
            "prescriber": "Dra. Ana Souza", "notes": None,
            "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
        },
        {
            "id": new_id(), "patient_id": patient_id, "name": "AAS", "dosage": "100", "unit": "mg",
            "route": "Via oral", "presentation": "Comprimido",
            "instructions": "Após o café", "frequency_type": "daily",
            "days_of_week": [], "interval_hours": None, "times": ["08:00"],
            "start_date": (today - timedelta(days=60)).isoformat(), "end_date": None,
            "continuous_use": True, "status": "active",
            "prescriber": "Dra. Ana Souza", "notes": None,
            "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
        },
    ]
    await db.medications.insert_many([m.copy() for m in meds])

    # Appointments / Exams / Vaccines
    await db.appointments.insert_many([{
        "id": new_id(), "patient_id": patient_id, "specialty": "Cardiologia",
        "professional": "Dra. Ana Souza", "date": (today + timedelta(days=6)).isoformat(),
        "time": "10:30", "location": "Clínica Vida - Sala 302", "kind": "consultation",
        "notes": None, "status": "scheduled", "created_at": iso(now_utc()),
    }, {
        "id": new_id(), "patient_id": patient_id, "specialty": "Endocrinologia",
        "professional": "Dr. Carlos Lima", "date": (today + timedelta(days=20)).isoformat(),
        "time": "14:00", "location": "Clínica Vida - Sala 210", "kind": "return",
        "notes": None, "status": "scheduled", "created_at": iso(now_utc()),
    }])

    await db.exams.insert_many([{
        "id": new_id(), "patient_id": patient_id, "name": "Hemograma completo",
        "date": (today + timedelta(days=3)).isoformat(), "time": "08:00",
        "location": "Laboratório Central", "status": "scheduled",
        "result_note": None, "created_at": iso(now_utc()),
    }])

    await db.vaccines.insert_many([{
        "id": new_id(), "patient_id": patient_id, "name": "Influenza",
        "date": (today + timedelta(days=11)).isoformat(), "time": "14:00",
        "location": "UBS Central", "status": "scheduled", "created_at": iso(now_utc()),
    }])

    # Measurements — 180 days of realistic history
    import random
    random.seed(42)
    measurements: list[dict] = []
    for i in range(180, -1, -1):
        d = today - timedelta(days=i)
        # weight (weekly)
        if i % 7 == 0:
            wv = round(72.8 + random.uniform(-0.6, 0.6) - i * 0.005, 1)
            measurements.append({
                "id": new_id(), "patient_id": patient_id, "kind": "weight",
                "value": {"weight": wv}, "unit": "kg",
                "recorded_at": iso(datetime.combine(d, time(9, 30), tzinfo=timezone.utc)),
                "actor_type": "patient" if i % 14 else "professional",
                "actor_name": "João Silva" if i % 14 else "Dra. Ana Souza",
                "created_at": iso(now_utc()),
            })
        # BP (every 3 days)
        if i % 3 == 0:
            sys = int(128 + random.uniform(-8, 12))
            dia = int(82 + random.uniform(-6, 8))
            measurements.append({
                "id": new_id(), "patient_id": patient_id, "kind": "blood_pressure",
                "value": {"systolic": sys, "diastolic": dia}, "unit": "mmHg",
                "recorded_at": iso(datetime.combine(d, time(8, 32), tzinfo=timezone.utc)),
                "actor_type": "patient" if i % 10 else "professional",
                "actor_name": "João Silva" if i % 10 else "Dra. Ana Souza",
                "created_at": iso(now_utc()),
            })
        # glucose (2x/week)
        if i % 4 == 0:
            gv = int(105 + random.uniform(-15, 25))
            measurements.append({
                "id": new_id(), "patient_id": patient_id, "kind": "glucose",
                "value": {"glucose": gv}, "unit": "mg/dL",
                "context": random.choice(["fasting", "before_meal", "after_meal"]),
                "recorded_at": iso(datetime.combine(d, time(7, 15), tzinfo=timezone.utc)),
                "actor_type": "patient" if i % 8 else "professional",
                "actor_name": "João Silva" if i % 8 else "Dr. Carlos Lima",
                "created_at": iso(now_utc()),
            })
        # abdominal (monthly)
        if i % 30 == 0:
            av = round(98 + random.uniform(-2, 2) - i * 0.01, 1)
            measurements.append({
                "id": new_id(), "patient_id": patient_id, "kind": "abdominal",
                "value": {"abdominal": av}, "unit": "cm",
                "recorded_at": iso(datetime.combine(d, time(9, 40), tzinfo=timezone.utc)),
                "actor_type": "professional", "actor_name": "Dra. Ana Souza",
                "created_at": iso(now_utc()),
            })

    # height (fixed) and IMC computed for each weight
    height_cm = 172
    measurements.append({
        "id": new_id(), "patient_id": patient_id, "kind": "height",
        "value": {"height": height_cm}, "unit": "cm",
        "recorded_at": iso(datetime.combine(today - timedelta(days=180), time(9, 0), tzinfo=timezone.utc)),
        "actor_type": "professional", "actor_name": "Dra. Ana Souza",
        "created_at": iso(now_utc()),
    })
    for m in [x for x in measurements if x["kind"] == "weight"]:
        wv = m["value"]["weight"]
        imc = round(wv / ((height_cm / 100) ** 2), 1)
        measurements.append({
            "id": new_id(), "patient_id": patient_id, "kind": "imc",
            "value": {"imc": imc, "auto": True}, "unit": "kg/m²",
            "recorded_at": m["recorded_at"], "actor_type": "professional",
            "actor_name": "Sistema", "created_at": iso(now_utc()),
        })

    await db.measurements.insert_many([m.copy() for m in measurements])

    # Symptoms
    await db.symptoms.insert_many([{
        "id": new_id(), "patient_id": patient_id,
        "text": "Leve tontura ao levantar da cama pela manhã.",
        "tags": ["Tontura"], "intensity": 3,
        "recorded_at": iso(datetime.combine(today - timedelta(days=2), time(8, 0), tzinfo=timezone.utc)),
        "actor_type": "patient", "actor_name": "João Silva",
        "created_at": iso(now_utc()),
    }])

    # Fall risk — 3 assessments
    await db.fall_risk.insert_many([
        {"id": new_id(), "patient_id": patient_id, "level": "moderate", "instrument": "Avaliação clínica",
         "score": None, "date": (today - timedelta(days=120)).isoformat(),
         "actor_type": "professional", "actor_name": "Dra. Ana Souza",
         "notes": "Uso de anti-hipertensivo. Reforçar orientações.", "created_at": iso(now_utc())},
        {"id": new_id(), "patient_id": patient_id, "level": "moderate", "instrument": "Avaliação clínica",
         "score": None, "date": (today - timedelta(days=60)).isoformat(),
         "actor_type": "professional", "actor_name": "Dra. Ana Souza",
         "notes": None, "created_at": iso(now_utc())},
        {"id": new_id(), "patient_id": patient_id, "level": "low", "instrument": "Avaliação clínica",
         "score": None, "date": (today - timedelta(days=7)).isoformat(),
         "actor_type": "professional", "actor_name": "Dra. Ana Souza",
         "notes": "Melhora após ajuste de medicação.", "created_at": iso(now_utc())},
    ])

    # Simulated adherence history — mark most doses as taken over the last 30 days
    dose_records = []
    for m in meds:
        start = _parse_date(m["start_date"])
        gen_start = max(start, today - timedelta(days=30))
        d = gen_start
        while d < today:
            for t in m["times"]:
                dt = datetime.combine(d, _parse_time(t), tzinfo=timezone.utc)
                # 92% taken, 5% not_taken, 3% pending
                r = random.random()
                if r < 0.92:
                    stat = "taken"
                elif r < 0.97:
                    stat = "not_taken"
                else:
                    stat = "pending"
                dose_records.append({
                    "id": new_id(), "patient_id": patient_id,
                    "medication_id": m["id"], "scheduled_at": iso(dt),
                    "status": stat, "recorded_at": iso(dt + timedelta(minutes=random.randint(0, 20))) if stat != "pending" else None,
                    "recorded_by": user_id, "actor_type": "patient", "actor_name": "João Silva",
                })
            d += timedelta(days=1)
    # today: mark first dose(s) taken
    for m in meds:
        for t in m["times"]:
            dt = datetime.combine(today, _parse_time(t), tzinfo=timezone.utc)
            if dt < now_utc() and random.random() < 0.8:
                dose_records.append({
                    "id": new_id(), "patient_id": patient_id, "medication_id": m["id"],
                    "scheduled_at": iso(dt), "status": "taken",
                    "recorded_at": iso(dt + timedelta(minutes=random.randint(1, 15))),
                    "recorded_by": user_id, "actor_type": "patient", "actor_name": "João Silva",
                })
    if dose_records:
        await db.medication_doses.insert_many([d.copy() for d in dose_records])

    # Notifications
    notifs = [
        {"id": new_id(), "patient_id": patient_id, "type": "medication",
         "title": "Hora do seu medicamento",
         "message": "Losartana 50 mg · 08:00", "read": False,
         "created_at": iso(now_utc() - timedelta(hours=2)), "action_url": "/(tabs)/medications"},
        {"id": new_id(), "patient_id": patient_id, "type": "appointment",
         "title": "Consulta em 6 dias",
         "message": f"Cardiologia · {(today + timedelta(days=6)).strftime('%d/%m/%Y')} às 10:30", "read": False,
         "created_at": iso(now_utc() - timedelta(hours=8)), "action_url": "/(tabs)/calendar"},
        {"id": new_id(), "patient_id": patient_id, "type": "exam",
         "title": "Exame em 3 dias",
         "message": "Hemograma · 08:00", "read": True,
         "created_at": iso(now_utc() - timedelta(days=1)), "action_url": "/(tabs)/calendar"},
    ]
    await db.notifications.insert_many([n.copy() for n in notifs])

    return {"ok": True, "email": DEMO_EMAIL, "password": DEMO_PASSWORD, "patient_id": patient_id}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api.get("/health")
async def health():
    return {"status": "ok", "time": iso(now_utc())}


@api.get("/")
async def root():
    return {"service": "Calen Health API", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    # Ensure demo data exists once at boot
    try:
        exists = await db.users.find_one({"email": DEMO_EMAIL})
        if not exists:
            await seed_demo()
            logger.info("Demo data seeded")
    except Exception as e:
        logger.warning(f"startup seed failed: {e}")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
    await _push_client.aclose()
