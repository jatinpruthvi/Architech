# Phase 1 Privacy Data-Flow Map

**Date:** 24 Aug 2026

| Flow | Data | Source | Destination | Purpose | Current storage | Gate |
|---|---|---|---|---|---|---|
| Lead enquiry | name, phone, message, listing ID, consent text | listing dialog | `/api/leads` | broker response | in-memory contract; Prisma model exists | LEG-002, LEG-007 |
| Broker session | user, role, organization, permissions | demo auth contract | `/api/auth/session` | protected broker workflows | demo object; Prisma model exists | LEG-002 |
| Listing draft | property facts, media-rights flag, RERA no. | broker draft flow | broker API | moderation | in-memory contract; Prisma model exists | LEG-002, LEG-003 |
| Media upload | file name, MIME, size, license evidence | broker upload | media API | moderation/derivatives | in-memory contract; Prisma model exists | LEG-003 |
| RERA correction | registration, field, proposed value, reason, email | public/admin | RERA correction API | provenance correction | in-memory contract; Prisma model exists | LEG-001, LEG-004 |
| Web Vitals | metric id/name/value/rating/route | browser | `/api/observability/web-vitals` | reliability/performance | structured logs | LEG-002 |

Production launch requires final retention periods, processor inventory, access/correction/deletion process, and incident response owner.
