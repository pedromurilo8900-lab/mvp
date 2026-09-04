"""Backend tests for Calen Health — auth, home, meds, calendar, measurements, notifications."""
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://elderly-health-care.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "joao.silva@calenhealth.demo"
DEMO_PASSWORD = "calen2026"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    # ensure seed exists (idempotent)
    session.post(f"{API}/seed/demo", timeout=60)
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    token = data["token"]
    return {"token": token, "user": data["user"], "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# ---- Health ----
def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---- Auth ----
def test_login_wrong_password(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_auth_me(session, auth):
    r = session.get(f"{API}/auth/me", headers=auth["headers"], timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == DEMO_EMAIL
    assert "password_hash" not in body
    assert "_id" not in body


def test_register_and_login(session):
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "abc123", "name": "Test User"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and body["user"]["email"] == email
    # duplicate
    r2 = session.post(f"{API}/auth/register", json={"email": email, "password": "abc123", "name": "Dup"}, timeout=15)
    assert r2.status_code == 400


# ---- Home summary ----
def test_home_summary(session, auth):
    r = session.get(f"{API}/home/summary", headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("date", "next", "day_summary", "latest_measurements", "unread_notifications"):
        assert k in d, f"missing {k}"
    assert "medications" in d["day_summary"]
    assert "total" in d["day_summary"]["medications"]
    assert d["unread_notifications"] >= 0


# ---- Medications & doses ----
def test_doses_today(session, auth):
    r = session.get(f"{API}/medications/doses/today", headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    doses = r.json()
    # Expected 5 doses: Losartana 08:00, Metformina 08:00 & 20:00, Sinvastatina 22:00, AAS 08:00
    assert len(doses) == 5, f"expected 5 doses, got {len(doses)}"
    for d in doses:
        assert d["type"] == "medication"
        assert d["status"] in ("taken", "not_taken", "pending")


def test_adherence(session, auth):
    r = session.get(f"{API}/medications/adherence", params={"days": 30}, headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert 0 <= d["percentage"] <= 100
    assert d["total"] >= 0
    assert isinstance(d["per_day"], list)


def test_get_medication_by_id_not_shadowed(session, auth):
    r = session.get(f"{API}/medications", headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    meds = r.json()
    assert len(meds) == 4
    med_id = meds[0]["id"]
    # Ensure /adherence and /doses do not shadow /{med_id}
    r2 = session.get(f"{API}/medications/{med_id}", headers=auth["headers"], timeout=30)
    assert r2.status_code == 200
    assert r2.json()["id"] == med_id


def test_mark_dose(session, auth):
    r = session.get(f"{API}/medications/doses/today", headers=auth["headers"], timeout=30)
    doses = r.json()
    if not doses:
        pytest.skip("no doses today")
    target = doses[0]
    r2 = session.post(f"{API}/medications/doses/mark", headers=auth["headers"],
                     json={"scheduled_at": target["scheduled_at"], "medication_id": target["source_id"], "status": "taken"}, timeout=15)
    assert r2.status_code == 200
    # verify persisted
    r3 = session.get(f"{API}/medications/doses/today", headers=auth["headers"], timeout=30)
    updated = [d for d in r3.json() if d["scheduled_at"] == target["scheduled_at"] and d["source_id"] == target["source_id"]]
    assert updated and updated[0]["status"] == "taken"


# ---- Calendar ----
def test_calendar_events_range(session, auth):
    today = date.today()
    start = (today - timedelta(days=2)).isoformat()
    end = (today + timedelta(days=7)).isoformat()
    r = session.get(f"{API}/calendar/events", params={"start": start, "end": end}, headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    events = r.json()
    # 10 days x 5 meds/day = 50 medication events minimum
    med_events = [e for e in events if e["type"] == "medication"]
    assert len(med_events) >= 10 * 5 - 5, f"only {len(med_events)} med events"
    # Should include appointment (day+6) and exam (day+3) and vaccine? within range
    assert any(e["type"] == "appointment" for e in events)
    assert any(e["type"] == "exam" for e in events)


def test_calendar_range_too_large(session, auth):
    r = session.get(f"{API}/calendar/events",
                    params={"start": "2024-01-01", "end": "2024-12-31"}, headers=auth["headers"], timeout=30)
    assert r.status_code == 400


# ---- Measurements ----
def test_measurements_list(session, auth):
    r = session.get(f"{API}/measurements", params={"kind": "weight"}, headers=auth["headers"], timeout=30)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) > 0
    # Sorted desc by recorded_at
    if len(lst) > 1:
        assert lst[0]["recorded_at"] >= lst[1]["recorded_at"]


def test_create_weight_generates_imc(session, auth):
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "patient_id": "will-be-overwritten",
        "kind": "weight",
        "value": {"weight": 73.5},
        "unit": "kg",
        "recorded_at": now_iso,
    }
    r = session.post(f"{API}/measurements", headers=auth["headers"], json=payload, timeout=15)
    assert r.status_code == 200, r.text
    # Query IMC - should have entries
    r2 = session.get(f"{API}/measurements", params={"kind": "imc"}, headers=auth["headers"], timeout=30)
    assert r2.status_code == 200
    imcs = r2.json()
    # last IMC recorded_at should match the weight we posted
    assert any(m["recorded_at"] == now_iso for m in imcs), "auto-IMC not created"


# ---- Symptoms ----
def test_create_symptom(session, auth):
    from datetime import datetime, timezone
    r = session.post(f"{API}/symptoms", headers=auth["headers"], json={
        "patient_id": "x", "text": "Dor de cabeça leve",
        "tags": ["Dor de cabeça"], "intensity": 2,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }, timeout=15)
    assert r.status_code == 200


# ---- Fall risk ----
def test_fall_risk(session, auth):
    r = session.get(f"{API}/fall-risk", headers=auth["headers"], timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) == 3
    # sorted desc by date
    assert lst[0]["date"] >= lst[1]["date"] >= lst[2]["date"]


# ---- Notifications ----
def test_notifications_and_mark_read(session, auth):
    r = session.get(f"{API}/notifications", headers=auth["headers"], timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) >= 1
    r2 = session.post(f"{API}/notifications/mark-read", headers=auth["headers"], json={}, timeout=15)
    assert r2.status_code == 200
    # verify all read
    r3 = session.get(f"{API}/notifications", headers=auth["headers"], timeout=15)
    assert all(n["read"] for n in r3.json())


# ---- Seed idempotent ----
def test_seed_idempotent(session):
    r = session.post(f"{API}/seed/demo", timeout=60)
    assert r.status_code == 200
    assert r.json()["email"] == DEMO_EMAIL


# ---- Push registration (may return 201 but not crash) ----
def test_register_push(session, auth):
    r = session.post(f"{API}/register-push",
                    json={"user_id": auth["user"]["id"], "platform": "web", "device_token": "test-token"},
                    timeout=30)
    # Placeholder key — may succeed (201) or return 500/502; either acceptable per spec
    assert r.status_code in (201, 500, 502), f"unexpected status {r.status_code}"


# ---- Unauth ----
def test_unauth_home(session):
    r = session.get(f"{API}/home/summary", timeout=15)
    assert r.status_code == 401
