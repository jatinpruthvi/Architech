# Phase 1 Privacy Data-Flow Map

**Date:** 30 Aug 2026

| Flow | Data | Source | Destination | Purpose | Current storage | Gate |
|---|---|---|---|---|---|---|
| Requirement brief | name, phone, city/locality slugs, property preferences, consent text | requirement form | `/api/requirements` | city-scoped requirement review | fixture memory; Prisma mode resolves location IDs, stores AES-256-GCM phone ciphertext + last four digits, and applies configured retention | LEG-002, LEG-007 |
| Lead enquiry | name, phone, message, listing ID, consent text | listing dialog | `/api/leads` | broker response | in-memory contract; Prisma model exists | LEG-002, LEG-007 |
| Broker session | user, role, organization, permissions | demo auth contract | `/api/auth/session` | protected broker workflows | demo object; Prisma model exists | LEG-002 |
| Listing draft | property facts, media-rights flag, RERA no. | broker draft flow | broker API | moderation | in-memory contract; Prisma model exists | LEG-002, LEG-003 |
| Media upload | file name, MIME, size, license evidence | broker upload | media API | moderation/derivatives | in-memory contract; Prisma model exists | LEG-003 |
| RERA correction | registration, field, proposed value, reason, email | public/admin | RERA correction API | provenance correction | in-memory contract; Prisma model exists | LEG-001, LEG-004 |
| Web Vitals | metric id/name/value/rating/route | browser | `/api/observability/web-vitals` | reliability/performance | structured logs | LEG-002 |

The requirement flow defaults to a 180-day window and must run the hard-delete purge at least daily. Production launch still requires legal approval of that period, approved periods for every other active flow, processor inventory, an access/correction/deletion process, managed encryption-key rotation, purge monitoring, and an incident-response owner.
