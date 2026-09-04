# Calen Health — PRD

## Vision
Mobile app in Brazilian Portuguese for **elderly patients and their caregivers** to manage medications, appointments, exams, vaccines, vital-sign records, adherence, fall-risk, and health evolution — with a professional, minimalist, high-legibility UI.

## Stack
- Frontend: Expo (SDK 57), React Native, expo-router, lucide-react-native, react-native-gifted-charts, react-native-toast-message, react-native-safe-area-context, react-native-calendars, @gorhom/bottom-sheet, expo-notifications.
- Backend: FastAPI + MongoDB (motor). bcrypt + JWT (PyJWT). Emergent-managed Push (SuprSend relay via `EMERGENT_PUSH_KEY`).

## Auth
Simple email/password with bcrypt + JWT (30-day). Endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`. Demo user auto-seeded on startup.

## Data Model
User, Patient, Medication, MedicationDose (adherence), Appointment, Exam, Vaccine, HealthMeasurement (weight/BP/glucose/abdominal/height/IMC — actor_type distinguishes professional vs patient), SymptomRecord, FallRiskAssessment, Notification. Each row keeps `actor_type`+`actor_name` for auditing.

## Key Rule — Medications in the Calendar
Calendar events are generated **dynamically** from `MedicationSchedule` (times[] + frequency_type: daily / specific_days / interval) via `GET /api/calendar/events?start&end` (max 62-day range). Doses are persisted only when marked. Editing/pausing a medication updates the calendar immediately.

## Screens (Bottom Tabs)
Início · Calendário · Medicamentos · Evolução · Perfil. Plus: notifications, record (5-in-1 vital logging), medication/[id], profile subpages (caregiver, notifications, privacy, help).

## Theming
Light + Dark tokens in `src/theme.ts` (colors from `design_guidelines.json`). Follows system by default; user can override in Profile → Aparência.

## Push Notifications
Emergent-managed relay. Frontend registers native device token on login via `POST /api/register-push`. Backend `send_push()` helper available for medication/appointment/exam reminders. Deployment pipeline replaces `EMERGENT_PUSH_KEY=placeholder`.

## Demo Seed
`joao.silva@calenhealth.demo / calen2026` — 180 days of realistic measurements, 4 active medications, upcoming consultations/exams/vaccines, adherence history, 3 fall-risk assessments, sample notifications.
