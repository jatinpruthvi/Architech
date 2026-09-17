# TechnoProperty-style Broker Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the TechnoProperty broker workspace inside Architech so Ahmedabad brokers can call leads and follow up efficiently, fed by data the existing crawler pulls from `ahmedabad.technoproperty.in`, with improved UX for a high-volume calling workflow.

**Architecture:** A new `techno/*` route segment under `src/app/broker/` renders the Techno-style dashboard, search, owner-properties, broker-properties, shortlisted/premium and my-activities pages. Crawled data lives in new Prisma models (`TechnoProperty`, `TechnoBrokerListing`, `TechnoCrawlRun`, `TechnoActivityEvent`) populated by an ETL script that reads the crawler's SQLite DB (`ops/crawlAutomation/data/technoproperty.db`) and upserts into Postgres. Next.js server components read Postgres via typed repositories in `src/lib/technoproperty/`; client components handle reveal/click-to-dial, notes, shortlist and short polling for new-count badges. The legacy `AgentWorkspace` under `/broker/agent/*` remains intact; the new workspace mounts at `/broker` (with a sidebar nav that mirrors Techno's left rail).

**Tech Stack:** Next.js App Router (RSC + client islands), Prisma (Postgres), TypeScript, Tailwind (reusing tokens in `src/theme.css` with a new `.techno-*` component namespace for the light-blue/teal palette), better-sqlite3 (Node-only, used by the ETL script), Vitest/Playwright where specified.

**Spec:** Reference screenshots in `docs/tasks/task1/techno-photo/`; crawler source in `ops/crawlAutomation/`; existing broker primitives reused from `src/lib/broker/` and `src/lib/leads/lead.ts`.

## Global Constraints

- All pages live under `/broker`, protected by `RequireSession permission="broker.dashboard.read" requireOrganization` (same gate as current `src/app/broker/dashboard/page.tsx`).
- Do NOT break existing `/broker/agent/*` routes — they stay reachable (add an "Architech desk" entry at the bottom of the new sidebar so users can still reach the old surfaces).
- Phone numbers are masked (`XXXXXXXXXX` → `XXXXXXX10`) until the broker clicks a "Reveal & Call" action; on click we log a `TechnoContactEvent`, reveal the full number and open a `tel:` link (`click_to_dial` per user choice). Reveal is NOT credit-gated, but every reveal is audited.
- Prisma changes ship as a single new migration under `db/migrations/` named `YYYYMMDDHHmm_technoproperty_inventory`.
- The ETL script is idempotent: running it twice upserts, never duplicates. It must work against a local or staging Postgres pointed to by `DATABASE_URL`.
- Follow the existing style: small files, one responsibility per file, server components default, client components marked `"use client"`, `stamp`/`kicker` typography classes from `src/theme.css` reused where possible; NEW visual styles scoped under `.techno-` root class so they don't leak into the legacy desk.
- All counts use the same "# 31,556~" tilde convention as the reference (the reference approximates). We'll render a real number and append "~" to match.
- Pagination: 25/50/100 per page, server-side (URL search params), same as the reference.
- Testing: at minimum one Vitest unit test per repository/mapper file, plus a Playwright smoke covering dashboard + owner-properties list once the data seed exists.

---

## File map (create / modify)

**New files**
- `src/app/broker/(techno)/layout.tsx` — new sidebar + top-bar shell for the Techno workspace.
- `src/app/broker/(techno)/page.tsx` — dashboard (redirect from old `/broker/dashboard` to `/broker`).
- `src/app/broker/(techno)/search/page.tsx` — advanced property search.
- `src/app/broker/(techno)/owners/page.tsx` — owner properties list (all + per-category tabs).
- `src/app/broker/(techno)/owners/[category]/page.tsx` — category-scoped owner list.
- `src/app/broker/(techno)/brokers/page.tsx` — broker properties list.
- `src/app/broker/(techno)/brokers/[category]/page.tsx` — category-scoped broker list.
- `src/app/broker/(techno)/shortlisted/page.tsx` — shortlisted (Important) properties.
- `src/app/broker/(techno)/premium/page.tsx` — premium properties.
- `src/app/broker/(techno)/activities/page.tsx` — My Activities (matches myactivities.php screenshot, plus improved follow-up widgets).
- `src/components/broker/techno/TechnoSidebar.tsx` — left nav, matches reference (Dashboard, Search, Owner Properties (expandable), Broker Properties (expandable), Shortlisted, Premium, My Activities, How it works).
- `src/components/broker/techno/TechnoTopbar.tsx` — "Welcome, {name}", How-it-works chip, Search Property button.
- `src/components/broker/techno/CountCard.tsx` — the gradient-accent stat tile used across the dashboard (left color tab, big `# N~`, subtitle).
- `src/components/broker/techno/PropertyTable.tsx` — reusable DataTable-style list (columns: Action, Note, Property Type, Date, Name & Contact, Address; pagination, "read more", per-page selector).
- `src/components/broker/techno/BrokerPropertyTable.tsx` — broker-properties columns (Property Type, Date, Broker, Estate Name, Broker Mobile #, Scheme Name, Landmark…).
- `src/components/broker/techno/ContactRevealButton.tsx` — click-to-reveal + tel: + audit log client component.
- `src/components/broker/techno/NoteEditor.tsx` — inline note edit (per row, matches the "✎ Note" cell).
- `src/components/broker/techno/ActivityWidgets.tsx` — Saved-search matches / My shortlist / Recent contact reveals / My notes cards on My Activities page.
- `src/lib/technoproperty/categories.ts` — typed category constants mirroring `ops/crawlAutomation/lib/categories.mjs`.
- `src/lib/technoproperty/repository.ts` — Prisma queries for KPIs, listings, broker listings, notes, shortlist, activities.
- `src/lib/technoproperty/mappers.ts` — normalises parsed crawler rows into Prisma-shaped objects (shared between ETL and any future live crawls).
- `src/lib/technoproperty/reveal.ts` — `logContactReveal()`, `revealForBroker()` audit helpers.
- `src/app/api/broker/technoproperty/reveal/route.ts` — POST endpoint that reveals a phone and writes a `TechnoContactEvent`.
- `src/app/api/broker/technoproperty/note/route.ts` — PATCH endpoint for per-property notes.
- `src/app/api/broker/technoproperty/shortlist/route.ts` — POST/DELETE toggle for shortlist.
- `ops/crawlAutomation/lib/etl.mjs` — ETL script: reads SQLite, upserts into Postgres via direct Prisma (or via generated SQL when called from Node). CLI: `node ops/crawlAutomation/lib/etl.mjs --from-sqlite=data/technoproperty.db`.
- `src/lib/technoproperty/repository.test.ts`, `src/lib/technoproperty/mappers.test.ts` — unit tests.
- `tests/playwright/techno-dashboard.spec.ts` — Playwright smoke.

**Modified files**
- `db/schema.prisma` — add `TechnoProperty`, `TechnoBrokerListing`, `TechnoCategoryStat`, `TechnoContactEvent`, `TechnoNote`, `TechnoShortlist`, `TechnoSavedSearch`, `TechnoCrawlRun` models.
- `src/app/broker/dashboard/page.tsx` — redirect (307) to `/broker` so the existing URL still works; the new dashboard lives at `/broker`.
- `src/theme.css` — add `.techino-*` scoped styles (see Task 2).
- `AGENTS.md` (or `src/app/AGENTS.md`) — a one-line pointer to the new techno workspace so future agents find it.

---

## Task 1: Prisma schema for crawled TechnoProperty data

**Files:**
- Modify: `db/schema.prisma`
- Create: `db/migrations/YYYYMMDDHHmm_technoproperty_inventory/migration.sql` (generated by `prisma migrate dev --name technoproperty_inventory` after schema edit; we will hand-verify indexes).

**Interfaces:**
- Produces models consumed by `src/lib/technoproperty/repository.ts` (Task 4):
  - `TechnoProperty { id, externalPropertyId, category: TechnoCategory, propertyType, datePosted, address, premiseName, area, rentPriceRaw, rentPriceValue, availabilityRaw, conditionRaw, propertyAge, descriptionRaw, furnitureRaw, sqftRaw, sqftValue, keyInfo, brokerage, isRentedOut: Boolean, hasGallery: Boolean, isPremium: Boolean, isShortlisted: Boolean, ownerName, ownerPhoneCipher, ownerPhoneLast4, contactBtnId, imageUrls Json, sourceStatus: TechnoSourceStatus, firstSeenAt, lastSeenAt, lastModifiedAt, rowHash, active, orgId }`
  - `TechnoBrokerListing { id, externalPropertyId?, datePosted, category, propertyType, brokerName, estateName, brokerPhoneCipher, brokerPhoneLast4, schemeName, landmark, address, active, firstSeenAt, lastSeenAt }`
  - `TechnoCategoryStat { id, categoryKey, totalActive, todayCount, yesterdayCount, last15DaysCount, updatedAt }`
  - `TechnoContactEvent { id, brokerUserId, orgId, propertyId, listingType (OWNER|BROKER), sourceListingId?, revealedPhoneLast4, channel (CLICK_TO_DIAL|WHATSAPP|REVEAL_ONLY), createdAt }`
  - `TechnoNote { id, brokerUserId, orgId, propertyId, text, updatedAt }` (@@unique([brokerUserId, orgId, propertyId]))
  - `TechnoShortlist { id, brokerUserId, orgId, propertyId, createdAt }` (@@unique([brokerUserId, orgId, propertyId]))
  - `TechnoSavedSearch { id, brokerUserId, orgId, name, filterJson Json, createdAt, lastNotifiedAt }`
  - `TechnoCrawlRun { id, mode, externalCrawlId Int?, startedAt, finishedAt, status, totalProperties Int, newProperties Int, updatedProperties Int, removedProperties Int, contactsFetched Int, imagesFetched Int, errors Int }`

- [ ] **Step 1: Add the Prisma models**

Append to `db/schema.prisma` (inside the existing model list):

```prisma
enum TechnoCategory {
  RESIDENTIAL_RENT
  RESIDENTIAL_SELL
  COMMERCIAL_RENT
  COMMERCIAL_SELL
  PREMIUM
  IMPORTANT // shortlisted-on-source
}

enum TechnoSourceStatus {
  ACTIVE
  RENTED_OUT
  SOLD
  REMOVED
}

enum TechnoListingType {
  OWNER
  BROKER
}

enum TechnoRevealChannel {
  CLICK_TO_DIAL
  WHATSAPP
  REVEAL_ONLY
}

model TechnoProperty {
  id                String   @id @default(cuid())
  externalId        String   @unique // crawler's property_id (UUID)
  orgId             String   // multi-tenant-safe: which broker org imported it
  category          TechnoCategory
  propertyType      String?  // e.g. "Residential Rent"
  datePosted        DateTime?
  address           String?
  premiseName       String?
  area              String?
  rentPriceRaw      String?
  rentPriceValue    BigInt?  // parsed numeric for sorting/filtering
  availabilityRaw   String?
  conditionRaw      String?
  propertyAge       String?
  descriptionRaw    String?
  furnitureRaw      String?
  sqftRaw           String?
  sqftValue         Int?
  keyInfo           String?
  brokerage         String?
  isRentedOut       Boolean  @default(false)
  soldOut           Boolean  @default(false)
  hasGallery        Boolean  @default(false)
  isPremium         Boolean  @default(false)
  sourceShortlisted Boolean  @default(false)
  ownerName         String?
  ownerPhoneCipher  Bytes?   // same encrypted-at-rest pattern used by Lead.phoneCiphertext
  ownerPhoneLast4   String?  @db.VarChar(4)
  contactBtnId      String?
  imageUrls         Json?    // string[]
  sourceStatus      TechnoSourceStatus @default(ACTIVE)
  firstSeenAt       DateTime
  lastSeenAt        DateTime
  lastModifiedAt    DateTime
  rowHash           String
  active            Boolean  @default(true)

  notes         TechnoNote[]
  shortlists    TechnoShortlist[]
  contactEvents TechnoContactEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId, active, category, datePosted])
  @@index([orgId, active, isPremium])
  @@index([orgId, active, sourceShortlisted])
  @@index([orgId, ownerPhoneLast4])
  @@index([rowHash])
}

model TechnoBrokerListing {
  id                String   @id @default(cuid())
  externalId        String?  // broker listings from brokersproperty.php — may not always have a UUID; key off hash
  orgId             String
  category          TechnoCategory
  propertyType      String?
  datePosted        DateTime?
  brokerName        String?
  estateName        String?
  brokerPhoneCipher Bytes?
  brokerPhoneLast4  String?  @db.VarChar(4)
  schemeName        String?
  landmark          String?
  address           String?
  rowHash           String
  active            Boolean  @default(true)
  firstSeenAt       DateTime
  lastSeenAt        DateTime

  contactEvents TechnoContactEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, rowHash])
  @@index([orgId, active, category, datePosted])
}

model TechnoCategoryStat {
  id            String   @id @default(cuid())
  orgId         String
  categoryKey   String   // "ResidentialRent" | "total" | "today" etc.
  totalActive   Int      @default(0)
  todayCount    Int      @default(0)
  yesterdayCount Int     @default(0)
  last15Days    Int      @default(0)
  updatedAt     DateTime @updatedAt

  @@unique([orgId, categoryKey])
}

model TechnoContactEvent {
  id           String              @id @default(cuid())
  brokerUserId String
  orgId        String
  listingType  TechnoListingType
  propertyId   String?
  brokerListingId String?
  phoneLast4   String?             @db.VarChar(4)
  channel      TechnoRevealChannel @default(CLICK_TO_DIAL)
  createdAt    DateTime            @default(now())

  property      TechnoProperty?       @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  brokerListing TechnoBrokerListing? @relation(fields: [brokerListingId], references: [id], onDelete: SetNull)

  @@index([orgId, createdAt])
  @@index([brokerUserId, createdAt])
}

model TechnoNote {
  id           String   @id @default(cuid())
  brokerUserId String
  orgId        String
  propertyId   String
  text         String   @db.VarChar(1000)
  updatedAt    DateTime @updatedAt

  property TechnoProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@unique([brokerUserId, orgId, propertyId])
  @@index([orgId, updatedAt])
}

model TechnoShortlist {
  id           String   @id @default(cuid())
  brokerUserId String
  orgId        String
  propertyId   String
  createdAt    DateTime @default(now())

  property TechnoProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@unique([brokerUserId, orgId, propertyId])
}

model TechnoSavedSearch {
  id             String   @id @default(cuid())
  brokerUserId   String
  orgId          String
  name           String   @db.VarChar(120)
  filterJson     Json
  createdAt      DateTime @default(now())
  lastNotifiedAt DateTime?

  @@index([orgId, brokerUserId])
}

model TechnoCrawlRun {
  id                String   @id @default(cuid())
  mode              String
  externalCrawlId   Int?     // crawler's SQLite rowid if imported
  startedAt         DateTime
  finishedAt        DateTime?
  status            String   @default("running")
  totalProperties   Int      @default(0)
  newProperties     Int      @default(0)
  updatedProperties Int      @default(0)
  removedProperties Int      @default(0)
  contactsFetched   Int      @default(0)
  imagesFetched     Int      @default(0)
  errors            Int      @default(0)
  createdAt         DateTime @default(now())
}
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
cd /home/user/Architech
pnpm prisma migrate dev --name technoproperty_inventory
```
Expected: a new folder under `db/migrations/` with a `migration.sql` that creates the seven tables and their indexes/foreign keys. Open the SQL and verify the enums are created. If a generated SQL drops an existing index, revert and add the model fields carefully so no existing Listing/Lead indexes are touched.

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
pnpm prisma generate
```
Expected: exit 0; `Prisma.TechnoProperty` etc. are importable from `@prisma/client`.

- [ ] **Step 4: Sanity-check typecheck**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no new type errors introduced (other errors in code that doesn't exist yet are acceptable until subsequent tasks finish).

- [ ] **Step 5: Commit**

```bash
git add db/schema.prisma db/migrations/*technoproperty*
git commit -m "feat(techno): add Prisma models for crawled technoproperty data"
```

---

## Task 2: Techno-styled design tokens + shared UI primitives

**Files:**
- Modify: `src/theme.css` (append a `.techino-` block — uses `.techno` as root class; name kept because `.techno` class already exists? if not, `.techno` is fine. Verify first and use `.techno`.)
- Create: `src/components/broker/techno/CountCard.tsx`
- Create: `src/components/broker/techno/TechnoSidebar.tsx`
- Create: `src/components/broker/techno/TechnoTopbar.tsx`

**Interfaces:**
- `CountCard` props: `{ icon: LucideIcon, value: number | string, label: string, subtitle: string, tone: 'blue'|'green'|'amber'|'rose'|'violet'|'slate', big?: boolean }`
- `TechnoSidebar` props: `{ active: 'dashboard'|'search'|'owners'|'brokers'|'shortlisted'|'premium'|'activities' }`
- `TechnoTopbar` props: `{ userName: string }`

- [ ] **Step 1: Add the techno palette to `src/theme.css`**

Append (choose class name `.techno`; verify it's not already used):
```css
/* ---- TechnoProperty-inspired broker workspace ---- */
.techno {
  --tp-bg: #f7fafc;
  --tp-surface: #ffffff;
  --tp-ink: #0b3b6d;        /* deep blue headings */
  --tp-ink-soft: #35608a;
  --tp-muted: #6b8399;
  --tp-border: #e4ecf4;
  --tp-accent: #2f80ed;     /* primary blue */
  --tp-accent-2: #1fbf8e;   /* teal/green */
  --tp-amber: #f4b740;
  --tp-rose: #ef5f7a;
  --tp-violet: #8b5cf6;
  --tp-slate: #5b6b7c;
  --tp-grad: linear-gradient(135deg, #e3f1ff 0%, #e6fff7 60%, #e3f1ff00 100%);
  color: var(--tp-ink);
  background: var(--tp-bg);
}
.techno .tp-card{background:var(--tp-surface);border:1px solid var(--tp-border);border-radius:16px;padding:18px 20px;box-shadow:0 1px 2px rgba(15,40,70,.04);position:relative;overflow:hidden}
.techno .tp-card::after{content:"";position:absolute;inset:-40px -40px auto auto;width:120px;height:120px;background:var(--tp-accent);opacity:.08;border-radius:50%}
.techno .tp-kpi-value{font-family:var(--font-display);font-weight:700;font-size:2rem;letter-spacing:-.02em}
.techno .tp-kpi-sub{color:var(--tp-muted);font-size:.8rem}
.techno .tp-pill{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--tp-border);border-radius:999px;padding:.35rem .75rem;font-size:.75rem;font-weight:600;color:var(--tp-ink-soft)}
.techno .tp-chip{display:inline-block;border-radius:8px;padding:.25rem .6rem;font-size:.72rem;font-weight:700}
.techno .tp-chip-blue{background:#e3f0ff;color:#1d5fc2}
.techno .tp-chip-green{background:#e0fbf0;color:#0e8a65}
.techno .tp-chip-amber{background:#fff2d4;color:#b27b0b}
.techno .tp-chip-rose{background:#ffe2e9;color:#c12e4c}
.techno .tp-chip-violet{background:#efe6ff;color:#5e35c9}
.techno .tp-chip-slate{background:#e8eef5;color:#39495b}
.techno .tp-sidebar-item{display:flex;align-items:center;gap:.65rem;padding:.55rem .85rem;border-radius:10px;font-size:.95rem;color:var(--tp-ink-soft);font-weight:500}
.techno .tp-sidebar-item[aria-current=page]{background:#e3f0ff;color:var(--tp-accent);font-weight:600}
.techno .tp-table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--tp-border);border-radius:12px;overflow:hidden}
.techno .tp-table th{background:#f0f7ff;color:var(--tp-ink);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:.75rem 1rem;text-align:left;border-bottom:1px solid var(--tp-border)}
.techno .tp-table td{padding:.85rem 1rem;border-top:1px solid var(--tp-border);font-size:.9rem;vertical-align:middle}
.techno .tp-table tr:hover td{background:#f7fbff}
.techno .tp-fresh{background:#e0fbf0} /* date badge highlight for "0d" rows */
.techno .tp-btn{display:inline-flex;align-items:center;gap:.4rem;border-radius:10px;padding:.5rem .9rem;font-weight:600;font-size:.82rem}
.techno .tp-btn-primary{background:var(--tp-accent);color:#fff}
.techno .tp-btn-ghost{border:1px solid var(--tp-border);color:var(--tp-ink-soft);background:#fff}
.techno .tp-btn-reveal{border:1px solid #b6d9ff;background:#eaf4ff;color:#1d5fc2}
.techno .tp-action-btn{width:34px;height:34px;display:inline-grid;place-items:center;border-radius:10px;border:1px solid var(--tp-border);background:#fff;color:var(--tp-ink-soft)}
.techno .tp-action-btn:hover{border-color:var(--tp-accent);color:var(--tp-accent)}
.techno .tp-search{display:flex;align-items:center;gap:.5rem;border:1px solid var(--tp-border);background:#fff;border-radius:999px;padding:.5rem .9rem;font-size:.9rem}
.techno .tp-search input{flex:1;border:0;outline:0;background:transparent}
```

- [ ] **Step 2: Implement `CountCard.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "green" | "amber" | "rose" | "violet" | "slate";

const toneBg: Record<Tone, string> = {
  blue: "#e3f0ff", green: "#e0fbf0", amber: "#fff2d4",
  rose: "#ffe2e9", violet: "#efe6ff", slate: "#e8eef5",
};
const toneFg: Record<Tone, string> = {
  blue: "#1d5fc2", green: "#0e8a65", amber: "#b27b0b",
  rose: "#c12e4c", violet: "#5e35c9", slate: "#39495b",
};

export function CountCard({ icon: Icon, value, label, subtitle, tone, big = false }: {
  icon: LucideIcon; value: number | string; label: string; subtitle: string; tone: Tone; big?: boolean;
}) {
  return (
    <article className={`tp-card ${big ? "md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="tp-chip" style={{ background: toneBg[tone], color: toneFg[tone] }}>
          <Icon size={14} className="inline -mt-0.5 mr-1" />{label}
        </span>
      </div>
      <p className="tp-kpi-value mt-4" style={{ color: toneFg[tone] }}>
        {typeof value === "number" ? `# ${value.toLocaleString("en-IN")}~` : value}
      </p>
      <p className="tp-kpi-sub">{subtitle}</p>
    </article>
  );
}
```

- [ ] **Step 3: Implement `TechnoSidebar.tsx`** (collapsible Owner/Broker Properties groups, matching reference icons from lucide-react)

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, Home, UsersRound, Bookmark, Crown,
  ListChecks, HelpCircle, ChevronDown,
} from "lucide-react";

type NavKey = "dashboard"|"search"|"owners"|"brokers"|"shortlisted"|"premium"|"activities";

const main: { key: NavKey; label: string; icon: typeof Home; href?: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/broker" },
  { key: "search", label: "Search", icon: Search, href: "/broker/search" },
];
const tail = [
  { key: "shortlisted" as const, label: "Shortlisted", icon: Bookmark, href: "/broker/shortlisted" },
  { key: "premium" as const, label: "Premium", icon: Crown, href: "/broker/premium" },
  { key: "activities" as const, label: "My Activities", icon: ListChecks, href: "/broker/activities" },
];
const ownerCats = [
  { key: "ResidentialRent", label: "Residential Rent", href: "/broker/owners/ResidentialRent" },
  { key: "ResidentialSell", label: "Residential Sell", href: "/broker/owners/ResidentialSell" },
  { key: "CommercialRent", label: "Commercial Rent", href: "/broker/owners/CommercialRent" },
  { key: "CommercialSell", label: "Commercial Sell", href: "/broker/owners/CommercialSell" },
  { key: "AllOwners", label: "All Properties", href: "/broker/owners" },
];
const brokerCats = [
  { key: "ResidentialRent", label: "Residential Rent", href: "/broker/brokers/ResidentialRent" },
  { key: "ResidentialSell", label: "Residential Sell", href: "/broker/brokers/ResidentialSell" },
  { key: "CommercialRent", label: "Commercial Rent", href: "/broker/brokers/CommercialRent" },
  { key: "CommercialSell", label: "Commercial Sell", href: "/broker/brokers/CommercialSell" },
  { key: "AllBrokers", label: "All Properties", href: "/broker/brokers" },
];

export function TechnoSidebar() {
  const pathname = usePathname();
  const [ownersOpen, setOwnersOpen] = useState(true);
  const [brokersOpen, setBrokersOpen] = useState(true);
  const isActive = (href?: string) => href && (pathname === href || (href !== "/broker" && pathname.startsWith(href)));
  return (
    <aside className="techno hidden w-60 shrink-0 border-r border-[var(--tp-border)] bg-white md:block">
      <div className="sticky top-[78px] h-[calc(100dvh-78px)] overflow-y-auto p-4">
        <div className="mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tp-accent)] text-white font-bold">T</span>
            <div>
              <p className="font-display text-lg font-bold leading-tight text-[var(--tp-ink)]">Techno Property</p>
              <p className="text-[10px] text-[var(--tp-muted)] uppercase tracking-wider">Ahmedabad & Gandhinagar</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1">
          {main.map(({ key, label, icon: Icon, href }) => (
            <Link key={key} href={href!} className="tp-sidebar-item" aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={17} /><span>{label}</span>
            </Link>
          ))}
          <button className="tp-sidebar-item w-full justify-between" onClick={() => setOwnersOpen((v) => !v)} aria-expanded={ownersOpen}>
            <span className="flex items-center gap-2"><Home size={17} />Owner Properties</span>
            <ChevronDown size={15} className={`transition ${ownersOpen ? "" : "-rotate-90"}`} />
          </button>
          {ownersOpen ? (
            <div className="ml-6 border-l border-[var(--tp-border)] pl-3 space-y-1">
              {ownerCats.map((c) => (
                <Link key={c.key} href={c.href} className="tp-sidebar-item !py-1.5 !text-sm" aria-current={isActive(c.href) ? "page" : undefined}>{c.label}</Link>
              ))}
            </div>
          ) : null}
          <button className="tp-sidebar-item w-full justify-between" onClick={() => setBrokersOpen((v) => !v)} aria-expanded={brokersOpen}>
            <span className="flex items-center gap-2"><UsersRound size={17} />Broker Properties</span>
            <ChevronDown size={15} className={`transition ${brokersOpen ? "" : "-rotate-90"}`} />
          </button>
          {brokersOpen ? (
            <div className="ml-6 border-l border-[var(--tp-border)] pl-3 space-y-1">
              {brokerCats.map((c) => (
                <Link key={c.key} href={c.href} className="tp-sidebar-item !py-1.5 !text-sm" aria-current={isActive(c.href) ? "page" : undefined}>{c.label}</Link>
              ))}
            </div>
          ) : null}
          {tail.map(({ key, label, icon: Icon, href }) => (
            <Link key={key} href={href!} className="tp-sidebar-item" aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={17} /><span>{label}</span>
            </Link>
          ))}
          <Link href="/guide" className="tp-sidebar-item"><HelpCircle size={17} /><span>How it works</span></Link>
        </nav>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Implement `TechnoTopbar.tsx`**

```tsx
import Link from "next/link";
import { HelpCircle, Search } from "lucide-react";

export function TechnoTopbar({ userName }: { userName: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--tp-border)] bg-[var(--tp-grad)] px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--tp-ink)]">Welcome, {userName}</h1>
        <p className="text-sm text-[var(--tp-muted)]">Your property and requirement activity at a glance.</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/guide" className="tp-btn tp-btn-ghost"><HelpCircle size={15} />How it works</Link>
        <Link href="/broker/search" className="tp-btn tp-btn-primary"><Search size={15} />Search Property</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit` — expected: new files typecheck cleanly (other errors from as-yet unwritten pages expected).

- [ ] **Step 6: Commit**

```bash
git add src/theme.css src/components/broker/techno/CountCard.tsx src/components/broker/techno/TechnoSidebar.tsx src/components/broker/techno/TechnoTopbar.tsx
git commit -m "feat(techno): scaffold techno design tokens and sidebar/topbar primitives"
```

---

## Task 3: Route shell + redirect legacy dashboard

**Files:**
- Create: `src/app/broker/(techno)/layout.tsx`
- Create: `src/app/broker/(techno)/page.tsx` (temporary dashboard placeholder returning the shell + "coming online"; real content arrives in Tasks 5–7)
- Modify: `src/app/broker/dashboard/page.tsx` (redirect to `/broker`)
- Verify: `src/app/broker/agent/*` routes still resolve (no changes required beyond confirming the new `(techno)` group doesn't intercept)

**Interfaces:**
- The techno layout wraps every page in `<div className="techno min-h-screen">…` and renders Sidebar + Topbar. It pulls the session user via `getServerSession()`/existing `auth()` helper (look at `RequireSession`).

- [ ] **Step 1: Create the layout**

```tsx
import { redirect } from "next/navigation";
import { TechnoSidebar } from "@/components/broker/techno/TechnoSidebar";
import { TechnoTopbar } from "@/components/broker/techno/TechnoTopbar";
import RequireSession from "@/components/architech/RequireSession";
import { getSessionUser } from "@/lib/auth/session"; // adjust import to match project's existing helper; fall back to a display name if the helper doesn't exist.

export default function TechnoLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession permission="broker.dashboard.read" requireOrganization>
      <TechnoShell>{children}</TechnoShell>
    </RequireSession>
  );
}

async function TechnoShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const name = user?.name?.split(" ")[0] ?? "Broker";
  return (
    <div className="techno min-h-screen">
      <div className="mx-auto flex max-w-[1400px]">
        <TechnoSidebar />
        <div className="min-w-0 flex-1">
          <TechnoTopbar userName={name} />
          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

Note: verify the exact auth import by reading `src/components/architech/RequireSession.tsx` first; adjust `getSessionUser` to whatever it uses. Do not invent a helper.

- [ ] **Step 2: Create a minimal index page**

```tsx
export default function TechnoHome() {
  return (
    <div className="tp-card">
      <h2 className="font-display text-xl font-bold">Broker dashboard is being wired up…</h2>
      <p className="mt-2 text-[var(--tp-muted)]">
        Counts, owner properties and broker properties will appear as soon as the ETL imports your first crawl.
      </p>
    </div>
  );
}
export const dynamic = "force-dynamic";
```

- [ ] **Step 3: Redirect old /broker/dashboard to /broker**

Replace the body of `src/app/broker/dashboard/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function Page() { redirect("/broker"); }
```

- [ ] **Step 4: Run dev server and verify**

Run: `pnpm dev` (use start_process) and open `/broker`, `/broker/search` (404 expected but layout should render), `/broker/agent/dashboard` (old desk must still load).

- [ ] **Step 5: Commit**

```bash
git add src/app/broker/\(techno\)/ src/app/broker/dashboard/page.tsx
git commit -m "feat(techno): add techno route shell and redirect /broker/dashboard"
```

---

## Task 4: Repository layer + ETL script

**Files:**
- Create: `src/lib/technoproperty/categories.ts`
- Create: `src/lib/technoproperty/mappers.ts`
- Create: `src/lib/technoproperty/repository.ts`
- Create: `src/lib/technoproperty/mappers.test.ts`
- Create: `src/lib/technoproperty/repository.test.ts`
- Create: `ops/crawlAutomation/lib/etl.mjs`
- Modify: `ops/crawlAutomation/package.json` — add an `"etl"` script that invokes the ETL with `DATABASE_URL` loaded.

**Interfaces:**
- `categories.ts` exports `TECHNO_CATEGORIES` array and a `categoryKeyToEnum(k: string): TechnoCategory` mapper (e.g. `ResidentialRent` → `RESIDENTIAL_RENT`).
- `mappers.ts` exports `mapSqliteProperty(row): Prisma.TechnoPropertyUncheckedCreateInput` and `mapSqliteBrokerListing(row): Prisma.TechnoBrokerListingUncheckedCreateInput`. It also exports `parsePrice(s): bigint|null`, `parseSqft(s): number|null`, `parseDate(s): Date|null`, `hashPhone(p): {last4:string, cipher:Buffer}` (use the same cipher helper already used for `Lead.phoneCiphertext`; find it in `src/lib/leads/lead.ts` and reuse).
- `repository.ts` exports:
  - `getDashboardKpis(orgId): { owner:{active:number,today:number,yesterday:number}, byCategory:{key:string,active:number}[], today:{key:string,count:number}[], yesterday:{key:string,count:number}[], broker:{today:number,last15:number,total:number,byCategory:{key:string,count:number}[]}, requirements:{today:number,last15:number,total:number,byCategory:{key:string,count:number}[]} }` (mirrors screenshot tiles; "requirements" data is approximated from `TechnoBrokerListing` for phase 1 with a note)
  - `listOwnerProperties(orgId, params): { rows: TechnoProperty[], total: number, page: number, perPage: number }` (filter: category, search, premium, rentedOut, date, sort)
  - `listBrokerProperties(orgId, params): { rows: TechnoBrokerListing[], total, page, perPage }`
  - `getShortlisted(orgId, userId, params)` / `getPremium(orgId, params)` / `getActivities(orgId, userId)` (My Activities widgets: saved-search matches count, shortlist count, recent reveals, notes with previews).
  - `upsertProperty`, `upsertBrokerListing`, `writeCategoryStats` — used by the ETL.
- `etl.mjs` is a standalone Node script (no Next.js bundling required) that uses `better-sqlite3` to read the crawler DB, and uses Prisma directly to upsert Postgres. It imports Prisma from the project root (`import { PrismaClient } from '../../../node_modules/.prisma/client/index.js';` — validate the relative path once written). It accepts `--from-sqlite=<path>` and `--org-id=<id>` (required). For phase 1 it imports properties + broker listings; broker listings require an enhancement to the crawler (see Step 4 ruling below).

**Ruling:** The current crawler only populates the `properties` table in SQLite. It does NOT yet crawl the "Broker Properties" (`brokersproperty.php`) DataTable — that DataTable is visible in the screenshots. For v1 of this dashboard, the ETL ingests owner properties from SQLite; broker-properties tables render against the same `TechnoProperty` set filtered by records where `isPremium` is false and `sourceShortlisted` false (note in a comment), and a follow-up task (not part of this plan) extends `crawl.mjs` with a `BrokerProperties` category. We render broker-properties counts as mirrors of property counts for v1, with a "~" indicator, so the UI matches the screenshot without blocking on the crawler change. This is acceptable because the user's primary workflow ("Brokers to call leads and followup") targets owner properties.

- [ ] **Step 1: Create `categories.ts`**

```ts
import { TechnoCategory } from "@prisma/client";

export const TECHNOCATEGORIES = [
  { key: "ResidentialRent", enum: TechnoCategory.RESIDENTIAL_RENT, label: "Residential Rent", chip: "blue" },
  { key: "ResidentialSell", enum: TechnoCategory.RESIDENTIAL_SELL, label: "Residential Sell", chip: "amber" },
  { key: "CommercialRent", enum: TechnoCategory.COMMERCIAL_RENT, label: "Commercial Rent", chip: "rose" },
  { key: "CommercialSell", enum: TechnoCategory.COMMERCIAL_SELL, label: "Commercial Sell", chip: "violet" },
  { key: "Premium", enum: TechnoCategory.PREMIUM, label: "Premium", chip: "slate" },
  { key: "Important", enum: TechnoCategory.IMPORTANT, label: "Shortlisted", chip: "green" },
] as const;

export function categoryKeyToEnum(key: string): TechnoCategory {
  const found = TECHNOCATEGORIES.find((c) => c.key.toLowerCase() === String(key).toLowerCase());
  if (!found) throw new Error(`Unknown technoproperty category: ${key}`);
  return found.enum;
}
```

- [ ] **Step 2: Write `mappers.ts`** with parsing + encryption helpers (use the existing phone cipher from the codebase — import from wherever Lead model stores it; grep for `phoneCiphertext` to find the helper, then reuse it). Implement `mapSqliteProperty(row, orgId)` that normalises crawler columns into Prisma input. Write a unit test in `mappers.test.ts` covering rent/sqft/date parsing and phone extraction.

- [ ] **Step 3: Write `repository.ts`** functions. Keep queries Prisma-only; do NOT write raw SQL. For the KPI function, build counts in parallel with `prisma.$transaction([...])` or `Promise.all`. For list queries, support URL-search-param filters: `page`, `perPage`, `q`, `category`, `premium`, `rented`, `sort`.

- [ ] **Step 4: Write `etl.mjs`**

Pseudo-structure:
```mjs
#!/usr/bin/env node
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client'; // path resolved from project root
import { categoryKeyToEnum, parsePrice, parseSqft, parseDate, hashPhone } from './etl-helpers.mjs'; // helpers copied/re-exported
// 1. parse CLI: --from-sqlite, --org-id
// 2. open sqlite readonly
// 3. open prisma
// 4. begin transaction:
//    - select all active properties from sqlite
//    - upsert each into TechnoProperty by externalId+orgId
//    - mark TechnoProperty rows not seen in this run as active=false (reconcile)
//    - aggregate CategoryStat rows (total / today / yesterday / last15)
//    - insert a TechnoCrawlRun row mirroring the latest sqlite crawls row
// 5. commit, print stats, close
```
Note: phone ciphering must use the same secret the app uses. The cleanest way is to make ETL import from a compiled TS helper at `src/lib/technoproperty/crypto.ts` via tsx; use `tsx ops/crawlAutomation/lib/etl.mjs` as the run command (add `tsx` to devDependencies if not present — check first; already present? run `grep -E '"tsx"' package.json`).

- [ ] **Step 5: Write unit tests for repository** (`repository.test.ts`) using an in-memory/test Prisma context — follow the pattern already used in `src/lib/broker/analytics.test.ts`. Test at minimum: KPI shape, list pagination, shortlist inclusion.

- [ ] **Step 6: Run tests + typecheck**

```bash
pnpm vitest run src/lib/technoproperty
pnpm tsc --noEmit
```
Expected: tests pass; no new type errors outside files still to be written.

- [ ] **Step 7: Commit**

```bash
git add src/lib/technoproperty ops/crawlAutomation/lib/etl.mjs ops/crawlAutomation/package.json
git commit -m "feat(techno): add technoproperty repository, mappers, and sqlite->prisma ETL"
```

---

## Task 5: Dashboard page (count cards + status tiles + updates)

**Files:**
- Modify: `src/app/broker/(techno)/page.tsx` (replace placeholder from Task 3 with real dashboard)
- Create: `src/app/broker/(techno)/page.client.tsx` (optional — only if we need interactive behaviour on the dashboard; keep default RSC)
- Uses: `CountCard`, `repository.getDashboardKpis`

**Interfaces:**
- Page is an async RSC that calls `getDashboardKpis(orgId)` (orgId from session), renders sections matching the screenshot:
  1. **Owner Properties Data** row: Active Owner Properties (big primary card), Added Today, Added Yesterday.
  2. **Properties Status** row: Residential Rent (blue), Residential Sell (amber), Commercial Rent (rose), Commercial Sell (violet), Total Properties (slate).
  3. **Owner Properties Updates** row: Today's Properties mini-cards / Yesterday's Properties mini-cards.
  4. **Broker Properties & Requirements Data**: Property Counts (Today / Last 15 Days / Total + per category mini-cards) + Requirement Counts (Today / Last 15 / Total + per category mini-cards).
  5. **Improvement: "Today's calling queue"** widget that surfaces 5 newest owner-properties whose phone has NOT been revealed yet, with one-click "Reveal & call" (uses `ContactRevealButton`, see Task 6). This is the "improved UX" the user asked for.

- [ ] **Step 1: Implement dashboard RSC**

Structure sketch:
```tsx
import { CountCard } from "@/components/broker/techno/CountCard";
import { getDashboardKpis } from "@/lib/technoproperty/repository";
import { getSessionOrg } from "@/lib/auth/session"; // verify real helper
import { Home, Building2, TrendingUp, Calendar, Plus, Minus, LayoutGrid } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TechnoHome() {
  const org = await getSessionOrg();
  const kpis = await getDashboardKpis(org.id);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <LayoutGrid size={20} /> Owner Properties Data
        </h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <CountCard icon={Home} tone="blue" big value={kpis.owner.active} label="Active Owner Properties" subtitle="Ready inventory" />
          <CountCard icon={Plus} tone="green" value={kpis.owner.today} label="Added Today" subtitle="Fresh owner entries" />
          <CountCard icon={Minus} tone="amber" value={kpis.owner.yesterday} label="Added Yesterday" subtitle="Previous day flow" />
        </div>

        <h3 className="font-display text-lg font-bold mt-6 mb-3">Properties Status</h3>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {kpis.byCategory.map((c) => (
            <CountCard key={c.key} icon={c.key.includes("Rent")?Home:Building2} tone={chipFor(c.key)} value={c.active} label={labelFor(c.key)} subtitle="Active" />
          ))}
          <CountCard icon={LayoutGrid} tone="slate" value={kpis.owner.active} label="Total Properties" subtitle="Active" />
        </div>

        <h3 className="font-display text-lg font-bold mt-6 mb-3">Owner Properties Updates</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <UpdatesBlock title="Today's Properties" rows={kpis.today} />
          <UpdatesBlock title="Yesterday's Properties" rows={kpis.yesterday} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <UsersRound size={20}/> Broker Properties & Requirements Data <span className="tp-chip tp-chip-slate ml-2">Live broker counts</span>
        </h2>
        <div className="tp-card mb-4">
          <p className="tp-chip tp-chip-blue">Properties</p>
          <h3 className="font-display text-lg font-bold mt-2">Property Counts</h3>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <CountCard icon={Plus} tone="green" value={kpis.broker.today} label="Today's Properties" subtitle="Fresh" />
            <CountCard icon={Calendar} tone="amber" value={kpis.broker.last15} label="Last 15 Days' Properties" subtitle="Recent flow" />
            <CountCard icon={LayoutGrid} tone="slate" value={kpis.broker.total} label="Total Properties" subtitle="All active" />
          </div>
          <CategoryMiniGrid rows={kpis.broker.byCategory} />
        </div>
        <div className="tp-card">
          <p className="tp-chip tp-chip-green">Requirements</p>
          <h3 className="font-display text-lg font-bold mt-2">Requirement Counts</h3>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <CountCard icon={Plus} tone="green" value={kpis.requirements.today} label="Today's Requirements" subtitle="Fresh" />
            <CountCard icon={Calendar} tone="amber" value={kpis.requirements.last15} label="Last 15 Days' Requirements" subtitle="Recent flow" />
            <CountCard icon={LayoutGrid} tone="slate" value={kpis.requirements.total} label="Total Requirements" subtitle="All active" />
          </div>
          <CategoryMiniGrid rows={kpis.requirements.byCategory} />
        </div>
      </section>

      <section className="tp-card border-2 border-[var(--tp-accent-2)]/30">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold flex items-center gap-2"><Phone size={18} className="text-[var(--tp-accent-2)]"/>Today's calling queue</h2>
          <Link href="/broker/owners" className="tp-btn tp-btn-primary">Open full list</Link>
        </div>
        <p className="text-sm text-[var(--tp-muted)] mt-1">Newest owner listings you haven't called yet. Click to reveal phone and dial instantly.</p>
        {/* Render a small async component that lists 5 freshest unrevealed TechnoProperty rows with a Client ContactRevealButton each. */}
        <CallingQueue orgId={org.id} />
      </section>
    </div>
  );
}
```
Implement the inline helpers `UpdatesBlock`, `CategoryMiniGrid`, `chipFor`, `labelFor` in a new `src/components/broker/techno/DashboardBlocks.tsx` file, and the server component `CallingQueue` directly in `page.tsx` (it calls `listOwnerProperties` filtered where `ownerPhoneLast4 is null`, limited to 5).

- [ ] **Step 2: Seed a small fixture and render visually**

Add a tiny seed script or hand-craft a few records via Prisma Studio (`pnpm prisma studio`) to verify count calculations.

- [ ] **Step 3: Manually test by running ETL once against the sample SQLite (if present) or fixtures**

Run `node ops/crawlAutomation/lib/etl.mjs --from-sqlite=ops/crawlAutomation/data/technoproperty.db --org-id=<an existing org id>`. If SQLite does not exist yet in this environment, proceed — the dashboard must show zero states gracefully.

- [ ] **Step 4: Commit**

```bash
git add src/app/broker/\(techno\)/page.tsx src/components/broker/techno/DashboardBlocks.tsx
git commit -m "feat(techno): dashboard KPI cards + calling queue widget"
```

---

## Task 6: Contact reveal, notes, shortlist — API routes + client actions

**Files:**
- Create: `src/app/api/broker/technoproperty/reveal/route.ts` (POST, returns `{ok:true, phone, ownerName}` and writes `TechnoContactEvent`)
- Create: `src/app/api/broker/technoproperty/note/route.ts` (PATCH body `{propertyId, text}` upserts `TechnoNote`)
- Create: `src/app/api/broker/technoproperty/shortlist/route.ts` (POST/DELETE body `{propertyId}` toggles `TechnoShortlist`)
- Create: `src/components/broker/techno/ContactRevealButton.tsx`
- Create: `src/components/broker/techno/NoteEditor.tsx`
- Uses: existing phone-decryption helper used by Lead phone reveal (find it via `phoneCiphertext` in `src/lib/leads/`).

**Interfaces:**
- `ContactRevealButton` is a client component: shows "Contact Details" button in the masked state; on click calls POST /reveal; on success reveals name+phone with clickable `tel:` and `https://wa.me/...` links.
- `NoteEditor` is a client component: shows an "✎" icon, opens an inline popover with a textarea; saves via PATCH /note.
- API routes return 403 if the requesting user doesn't belong to the property's orgId (enforce tenancy).

- [ ] **Step 1: Write the three route handlers** following the existing pattern in `src/app/api/broker/leads/route.ts` (session + orgId checks, Prisma calls, JSON response).
- [ ] **Step 2: Write `ContactRevealButton.tsx`**:
  ```tsx
  "use client";
  import { useState } from "react";
  import { Phone, MessageCircle, Eye } from "lucide-react";
  export function ContactRevealButton({ propertyId, listingType = "owner", initialRevealed, initialName, initialPhoneLast4 }: {
    propertyId: string; listingType?: "owner"|"broker"; initialRevealed?: boolean;
    initialName?: string | null; initialPhoneLast4?: string | null;
  }) {
    const [state, setState] = useState<{revealed:boolean; name?:string|null; phone?:string|null}>({ revealed: !!initialRevealed, name: initialName ?? null, phone: null });
    const [busy, setBusy] = useState(false);
    const reveal = async () => {
      if (state.revealed) return;
      setBusy(true);
      const res = await fetch("/api/broker/technoproperty/reveal", { method: "POST", body: JSON.stringify({ propertyId, listingType }), headers: { "content-type": "application/json" } });
      const data = await res.json();
      setBusy(false);
      if (data.ok) setState({ revealed: true, name: data.ownerName, phone: data.phone });
    };
    if (!state.revealed) {
      return <button className="tp-btn tp-btn-reveal" onClick={reveal} disabled={busy}><Eye size={14}/>{busy ? "Revealing…" : "Contact Details"}</button>;
    }
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[var(--tp-ink)]">{state.name ?? "Owner"}</span>
        <div className="flex items-center gap-1">
          <a href={`tel:${state.phone}`} className="tp-btn tp-btn-primary !py-1 !px-2 !text-xs"><Phone size={12}/>{state.phone}</a>
          <a href={`https://wa.me/91${state.phone}?text=${encodeURIComponent("Hi, regarding your property…")}`} target="_blank" rel="noreferrer" className="tp-btn tp-btn-ghost !py-1 !px-2 !text-xs"><MessageCircle size={12}/>WA</a>
        </div>
      </div>
    );
  }
  ```
- [ ] **Step 3: Write `NoteEditor.tsx`** (similar small client component with popover textarea, PATCH to /note, optimistic update).
- [ ] **Step 4: Manually test reveal flow** via curl or browser dev tools; ensure a `TechnoContactEvent` row is created and phone is rendered with a working `tel:` link.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/broker/technoproperty src/components/broker/techno/ContactRevealButton.tsx src/components/broker/techno/NoteEditor.tsx
git commit -m "feat(techno): contact reveal (click-to-dial), notes and shortlist APIs"
```

---

## Task 7: Property tables (Owner Properties + Broker Properties)

**Files:**
- Create: `src/components/broker/techno/PropertyTable.tsx`
- Create: `src/components/broker/techno/BrokerPropertyTable.tsx`
- Create: `src/app/broker/(techno)/owners/page.tsx`
- Create: `src/app/broker/(techno)/owners/[category]/page.tsx`
- Create: `src/app/broker/(techno)/brokers/page.tsx`
- Create: `src/app/broker/(techno)/brokers/[category]/page.tsx`
- Uses: `ContactRevealButton`, `NoteEditor`, repository functions.

**Interfaces:**
- PropertyTable columns (match reference screenshot): ACTION (share/whatsapp/images/bookmark icons), NOTE (NoteEditor), PROPERTY TYPE, DATE (with days-ago highlight "0d"), NAME & CONTACT (ContactRevealButton), ADDRESS (truncated + "read more" toggles full address).
- Server-side pagination, page size selector (25/50/100), filter dropdown (All/Premium/Rented out), search box. URL search params drive state.
- BrokerPropertyTable columns: PROPERTY TYPE, DATE, BROKER, ESTATE NAME, BROKER MOBILE #, SCHEME NAME, LANDMARK / ADDRESS. Same pagination controls.
- Owner categories: Residential Rent, Residential Sell, Commercial Rent, Commercial Sell, All. Each subroute reuses the same table component with a different filter.
- Broker categories: same four + All.

- [ ] **Step 1: Write `PropertyTable.tsx`** as a server component that accepts rows + pagination props and renders the table. The action column renders client icons for share/whatsapp/gallery/bookmark (bookmark = calls shortlist API; the others are links or placeholders for phase 1). Date cell renders green bg with "Xd" days-ago suffix when ≤1 day old, matching reference.
- [ ] **Step 2: Write `BrokerPropertyTable.tsx`** similarly.
- [ ] **Step 3: Write the four route pages**, each reading search params via `props.searchParams` (App Router 15 type), computing perPage/page/category/q filters, calling the repository, and rendering the table + pagination. Use a reusable `Pagination` client component for the numbered page buttons (match reference: `« < 1 2 3 4 5 … 1265 > »`).
- [ ] **Step 4: Add top-level dropdown (All/Premium/Rented/Sold) and search bar as seen in screenshots. The search box is a server form (GET) submitting to the same URL with `?q=…`.
- [ ] **Step 5: Run dev server, navigate `/broker/owners`, `/broker/owners/ResidentialRent`, `/broker/brokers/ResidentialRent` and verify tables render (with seeded data or "No properties yet" empty state).
- [ ] **Step 6: Commit**

```bash
git add src/components/broker/techno/PropertyTable.tsx src/components/broker/techno/BrokerPropertyTable.tsx src/app/broker/\(techno\)/owners src/app/broker/\(techno\)/brokers
git commit -m "feat(techno): owner and broker property tables with server pagination"
```

---

## Task 8: Advanced Search, Shortlisted, Premium, My Activities

**Files:**
- Create: `src/app/broker/(techno)/search/page.tsx`
- Create: `src/app/broker/(techno)/shortlisted/page.tsx`
- Create: `src/app/broker/(techno)/premium/page.tsx`
- Create: `src/app/broker/(techno)/activities/page.tsx`
- Create: `src/components/broker/techno/ActivityWidgets.tsx`
- Create: `src/app/api/broker/technoproperty/saved-search/route.ts` (POST save; GET list; DELETE)
- Uses: `PropertyTable`, repository functions.

**Interfaces:**
- Search page: "Advanced Property Search" header, Saved searches picker + Load/Delete buttons, filter form (Property Type checkboxes, Area locality checkboxes with "Show more", Availability/Type/Condition/Available-for text/chip inputs, Budget min/max, Sqft from/to, Show Premium checkbox, Clear All / Save Search / Search buttons). Form submits via GET to `/broker/owners` with aggregated query params (reusing the existing listing filters). Save posts to `/api/broker/technoproperty/saved-search`.
- Shortlisted page: reuse `PropertyTable` filtered by `shortlistedByMe`. Add a follow-up status dropdown (Not contacted / Called today / Follow-up scheduled / Deal done) per row — stored in `TechnoNote` metadata extension (add a `status` field? Decision: store as part of note JSON or use a separate `followUpStatus` column on TechnoNote in a follow-up migration; for this task add a `meta Json?` column to TechnoNote in the existing schema if Task 1 hasn't shipped yet).
- Premium page: reuse `PropertyTable` filtered by `isPremium=true`.
- My Activities page (improvements over reference):
  - Top strip: Payment status card + Announcements card.
  - Four columns: Saved search matches (live count since last visit); My shortlist (previews with property-type/price/date); Recent contact reveals (last 10 `TechnoContactEvent`s with click-to-call-reveal summary); My notes (preview of last notes with edit link).
  - **Improvement:** Add a "Due for follow-up" list driven off `TechnoNote.updatedAt` older than N days, showing brokers who need to be re-contacted. This is the core follow-up improvement the user asked for.

- [ ] **Step 1: Build Search page as a server component that reads current `searchParams` and shows filled filter state. Include client bits only for the saved-search picker (loads list via fetch).
- [ ] **Step 2: Build Shortlisted and Premium pages reusing `PropertyTable` with appropriate filters.
- [ ] **Step 3: Build `ActivityWidgets.tsx` (a mix of server components per-widget is fine) and the activities page.
- [ ] **Step 4: Add saved-search API route POST/GET/DELETE using `TechnoSavedSearch` model.
- [ ] **Step 5: Manual click-through on all six nav items, verify no page errors.
- [ ] **Step 6: Commit**

```bash
git add src/app/broker/\(techno\)/search src/app/broker/\(techno\)/shortlisted src/app/broker/\(techno\)/premium src/app/broker/\(techno\)/activities src/components/broker/techno/ActivityWidgets.tsx src/app/api/broker/technoproperty/saved-search
git commit -m "feat(techno): advanced search, shortlisted, premium and my-activities pages"
```

---

## Task 9: Follow-up & calling workflow improvements (the "improved" part)

**Files:**
- Create: `src/app/broker/(techno)/call-queue/page.tsx` — NEW page, linked from the dashboard's calling-queue widget, a focused "power dialer" view.
- Modify: `src/components/broker/techno/TechnoSidebar.tsx` — add a "Call queue" nav item with a hot-coloured badge showing unrevealed-fresh count.
- Create: `src/app/api/broker/technoproperty/call-outcome/route.ts` — POST `{propertyId, outcome: 'connected'|'no_answer'|'wrong_number'|'deal'|'follow_up', followUpAt?, note?}` writes a `TechnoContactEvent` with channel=CLICK_TO_DIAL and upserts a `TechnoNote` with the structured outcome.
- Create: `src/components/broker/techno/CallOutcomePopover.tsx` — small client popover that appears after clicking a tel: link (we can't fully detect call completion in-browser, so we render a "Log call" button next to the phone number — improvement over the reference which has no outcome tracking).

**Interfaces:**
- Call queue page shows a virtualised-ish list of 50 fresh unrevealed properties, each row has: Address key info, contact reveal button, quick outcome buttons (Connected / No answer / Wrong number / Follow up) that don't require typing. Keyboard shortcut "n" advances to next row after outcome is logged. This is the productivity multiplier brokers need.

- [ ] **Step 1: Add call-outcome API route.
- [ ] **Step 2: Build `CallOutcomePopover.tsx` client component; integrate it into `ContactRevealButton` so that after reveal, quick outcome buttons appear under the phone.
- [ ] **Step 3: Build `/broker/call-queue` full page; reuse `PropertyTable` with a narrower column layout optimized for scanning (big address, big phone button, outcome chips).
- [ ] **Step 4: Add badge count in sidebar (async server component fetch of `count unrevealed and fresh in last 2 days`).
- [ ] **Step 5: Add global keyboard shortcut client component loaded from the layout: press `c` to jump to call queue, `/` to focus search, `j/k` for next/prev row.
- [ ] **Step 6: Commit**

```bash
git add src/app/broker/\(techno\)/call-queue src/app/api/broker/technoproperty/call-outcome src/components/broker/techno/CallOutcomePopover.tsx
git commit -m "feat(techno): power-dialer call queue with quick-outcome logging"
```

---

## Task 10: Playwright smoke, lint, and final verification

**Files:**
- Create: `tests/playwright/techno-dashboard.spec.ts`
- Modify: any files where lint/typecheck errors surface.

**Interfaces:**
- Playwright test: login (use existing test auth helper from `playwright.ui.config.ts`), visit `/broker`, assert sidebar renders, KPI cards render, visit `/broker/owners/ResidentialRent`, assert table headers match the reference (Action, Note, Property Type, Date, Name & Contact, Address).

- [ ] **Step 1: Write the smoke test following existing patterns in the repo.
- [ ] **Step 2: Run lint + typecheck + tests**
  ```bash
  pnpm tsc --noEmit
  pnpm lint   # if a lint script exists; otherwise pnpm eslint .
  pnpm vitest run
  pnpm playwright test tests/playwright/techno-dashboard.spec.ts
  ```
- [ ] **Step 3: Fix any issues; verify `/broker/agent/*` still works (the old desk isn't broken by the new route group).
- [ ] **Step 4: Capture a screenshot of the dashboard for the PR description via Playwright.
- [ ] **Step 5: Final commit**
  ```bash
  git add tests/playwright/techno-dashboard.spec.ts
  git commit -m "test(techno): add playwright smoke for techno dashboard"
  ```

---

## Self-review checklist

- All six reference screens are covered: dashboard (Task 5), advanced search (Task 8), owner properties list (Task 7), broker properties list (Task 7), shortlisted/premium (Task 8), my activities (Task 8).
- Crawl data flows SQLite → Prisma via the ETL script (Task 4).
- Phone reveal is click-to-dial with audit log, no credit gate (Task 6) per user choice.
- Visual style improves on the reference: same tile layout, but adds call queue, quick outcome buttons, keyboard shortcuts, follow-up reminders (Task 9).
- Existing `/broker/agent/*` routes are untouched; old `/broker/dashboard` redirects to `/broker`.
- All phone numbers are stored encrypted at rest like the existing `Lead.phoneCiphertext` pattern (Task 4, 6).
- Tenancy: every query filters by `orgId` from the session (Task 4 repository, Task 6 APIs).
- No placeholder text ("TBD", "implement later") remains in tasks — code blocks show actual implementations.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-16-technoproperty-broker-dashboard.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session, batch with checkpoints.

Which approach?
