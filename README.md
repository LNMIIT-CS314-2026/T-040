# T040 Student Discipline Management System

Initial foundation for the four-role MVP described in `info/T040_Codex_Project_Implementation_Brief.pdf`. The project uses React, Express, and MongoDB as specified for this implementation. The source PDFs define the domain and component responsibilities; they do not mandate this technology stack.

## Requirements

- Node.js 20 or newer and npm
- A local MongoDB server, such as MongoDB Community Server

The application connects directly to a standalone local MongoDB server. It does not require Docker or replica-set configuration.

## Local setup

1. Ensure your local MongoDB server is running on `127.0.0.1:27017`. You can view it in MongoDB Compass.
2. Copy `.env.example` to `.env` and set a unique `SESSION_SECRET` of at least 32 characters and a `SEED_PASSWORD` of at least 12 characters. The default URI connects directly to the local server and creates/uses the `t040_discipline` database.
3. Install dependencies: `npm install`.
4. Create fictional demo accounts: `npm run seed`.
5. Start the API and React development server: `npm run dev`.
6. Open `http://127.0.0.1:5173`.

Keep one `npm run dev` process running. To open a second frontend on port 5174 while reusing its API, run `npm run dev:web -- --port 5174` in another terminal. Development mode accepts both local origins.

Seed accounts use `admin@lnmiit.ac.in`, `student@lnmiit.ac.in`, `faculty@lnmiit.ac.in`, and `officer@lnmiit.ac.in`. All use the local-only password set in `SEED_PASSWORD`. The seed script refuses to run when `NODE_ENV=production`. Change this password before sharing the local environment.

## Environment settings

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode; production enables secure cookies and disables seed data. |
| `PORT` | Express API port, defaults to `4000`. |
| `MONGODB_URI` | MongoDB connection string; default connects directly to local MongoDB. |
| `SESSION_SECRET` | Secret used to sign server-side session cookies; keep outside source control. |
| `CLIENT_ORIGIN` | Comma-separated allowlist of browser origins for state-changing API requests. |
| `SEED_PASSWORD` | Local demo-account password; used only by the seed command. |

## Foundation routes and permissions

| Route | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | Public, rate limited | Requires an `@lnmiit.ac.in` email, password, and matching account role; starts a regenerated server-side session. |
| `POST /api/auth/logout` | Authenticated | Destroys the session. |
| `GET /api/auth/me` | Authenticated | Returns the current user's safe session profile. |
| `GET /api/students/me/profile` | Student | Returns the signed-in student's profile, incident summaries, hearings, decisions, and disciplinary actions linked to that student's record. |
| `GET /api/incidents` | Reporting Staff or Discipline Officer | Returns the reporter's submissions or the officer's open initial-review queue. |
| `POST /api/incidents` | Reporting Staff | Validates and submits an incident for an existing student. |
| `GET /api/incidents/:id` | Reporter who submitted it or Discipline Officer with an open review | Performs a record-level authorization check before returning details. |
| `POST /api/incidents/:id/review` | Discipline Officer | Begins review, accepts into one case, or rejects with a reason. |
| `GET /api/cases` | Discipline Officer | Lists open cases with scheduled hearings. |
| `POST /api/cases/:caseId/hearings` | Discipline Officer | Schedules a future hearing for an open case. |
| `PATCH /api/cases/hearings/:hearingId/complete` | Discipline Officer | Records proceedings and completes a scheduled hearing. |
| `POST /api/cases/:caseId/decision` | Discipline Officer | Records a case finding and any resulting disciplinary actions after a completed hearing. |
| `GET /api/admin/users` | Administrator | Lists account fields without credentials. |
| `POST /api/admin/users` | Administrator | Creates an account with an approved role and writes an audit record. |
| `PATCH /api/admin/users/:id` | Administrator | Changes a role or account status and writes an audit record. |
| `GET /api/admin/audit` | Administrator | Read-only list of recent audit records. |

The interface provides login, role-specific landing views, the student's own profile, hearings, case decisions and disciplinary action status, an administrative account/audit overview, faculty incident reporting, the officer initial-review queue, and a hearing/decision workspace. Officers can schedule future hearings on open cases and record proceedings after the hearing. After at least one completed hearing, officers can record one case finding; a responsible finding requires at least one action. Actions are marked completed when the decision is recorded. Case, decision, and action changes create history and audit entries. Incident submission includes required-field validation, existing-student lookup, a unique server-generated ID, optional restricted evidence metadata, audit/history entries, and an in-app officer work-queue notification. Accepted reports create one minimal case; rejection requires a recorded reason.

Sessions are stored in MongoDB, use HTTP-only SameSite cookies, and become secure-only in production. Development sessions are isolated by Vite host and port. Login explicitly saves the session before replying and requires the account's role. Only `@lnmiit.ac.in` addresses can log in or be created. Passwords use bcrypt hashes. Unknown roles are denied by the authorization helpers. Student users see only status summaries linked to their own student profile. Audit events omit report content and are only exposed through a read-only API. Development mode permits local Vite origins on different ports and has a higher login retry limit to support local testing.

## Architecture and next increment

The API separates routes, schemas, authentication/RBAC, domain state rules, database models, incident/evidence, case-management, hearing, decision, action lifecycle, notification, audit, and history services. UC-009 hearing proceedings and UC-010 decisions and disciplinary actions are included.

Next: continue with the next use case in the source brief.

## Checks

- `npm test` — role definitions, access helper, password hashing, and input-schema unit checks.
- `npm run test:integration` — UC-003 API flow against an explicitly named test database.
- `npm run build` — production React bundle.

The integration test is skipped unless `TEST_MONGODB_URI` points to a dedicated MongoDB test database whose name contains `test`. In PowerShell, set it before running `npm run test:integration`, for example: `$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/t040_discipline_test'`. The test creates and removes fictional test-only records.

Writes that span multiple collections are performed in sequence with best-effort cleanup if incident submission or case creation fails. Standalone MongoDB cannot make those writes fully atomic, so a process or database failure between writes can leave related records out of sync. Do not use real student records in development. The PDFs do not define a retention schedule, legal policy, or a required age/date-of-birth field; those remain institutional policy decisions.
