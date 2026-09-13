# CareFall

Senior-living emergency-response system — hackathon project (3-person team).

## Modules

| Module | Owner | Route |
|--------|-------|-------|
| Fall Detection | Person 1 | `/camera/204` |
| Incident Response | Person 2 | `/dashboard`, `/responder` |
| Post-Fall Assessment | Person 3 | `/responder/incident/:id/assessment` |

## Run

```bash
npm install
npm run dev
```

Then open `/responder/incident/incident-demo-001/assessment`. No environment
variables are required — see `.env.example` for the optional ones.

## Plan

See **[PLAN.md](./PLAN.md)** for architecture, shared contracts, and integration checklist.

Module specs:

- [Module 1 — Fall Detection](./docs/module-1-fall-detection.md)
- [Module 2 — Incident Response](./docs/module-2-incident-response.md)
- [Module 3 — Post-Fall Assessment](./docs/module-3-post-fall-assessment.md)
  — [implementation notes](./docs/module-3-implementation.md)

## Demo facility

**Oakwood Senior Living** — Room **204**, Margaret Davis. Responder: Sarah Miller, CNA.
