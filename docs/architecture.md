# Architecture and requirement mapping

| Source responsibility | Current module | UC-003 increment |
| --- | --- | --- |
| Web User Interface | `frontend/src/app` and `frontend/src/features` | Faculty report form, reporter history, officer queue and review detail. |
| Authentication & RBAC | `backend/src/auth` and `backend/src/api` | Role checks run on every endpoint; report and review operations are server-gated. |
| Incident & Evidence Service | `backend/src/services/incidentService.js` and `evidenceService.js` | Validates student references, creates unique incident IDs, stores restricted metadata, and applies incident transitions. |
| Case Management Service | `backend/src/services/caseManagementService.js` | Creates a single initial case from an accepted incident. `DisciplinaryCase.incidentId` is unique. |
| Hearing & Decision Service | Future UC-009/UC-010 increment | Keep a distinct service boundary; no hearing or decision workflow is implemented here. |
| Disciplinary Action Service | Future UC-010 increment | Preserve the source lifecycle: Assigned → Pending → In Progress → Completed or Not Completed; Not Completed → In Progress. |
| Notification Service | `backend/src/services/notificationService.js` | Adds a role-addressed officer queue notification on submission and reporter notifications on review. |
| Audit / Case History Service | `auditService.js`, `incidentHistoryService.js`, and `caseHistoryService.js` | Stores actor, action, entity and state references without logging incident descriptions. |
| Institutional Database | Mongoose models under `backend/src/models` | MongoDB collections with references and unique constraints; connects directly to standalone MongoDB. |

## UC-003 traceability

- Report fields and existing student lookup: `incidentSchemas.js`, `StudentProfile`, `submitIncident`.
- Draft → Submitted: incident creation records the transition and related submission records in ordered writes.
- Submitted → Under Initial Review: the officer must begin review before deciding an outcome.
- Under Initial Review → Converted to Case → Final: case creation, incident history, audit and reporter notification commit together.
- Under Initial Review → Rejected/Closed → Final: the officer must provide a reason; the reason is preserved in incident history and the record.
- Incident 1 — 0..1 Case: the case's incident reference has a unique database index.
- Student isolation: reporters list only their submissions; officers list active review items; per-record lookups apply the same checks. Students and administrators have no incident-detail API permission by default.
- Multi-collection writes use ordered operations and best-effort compensating cleanup for incident submission and case creation. Standalone MongoDB does not provide transaction-level atomicity; interruption between writes can leave related records out of sync.

Incident reports use a subject field in place of category; severity is not collected or stored. Evidence is metadata-only. File upload, protected storage and authorized file download need a separately configured storage component.
