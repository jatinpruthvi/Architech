"use client";
/*
  India-wide agent workspace: an architectural operating desk for source-led,
  evidence-first brokerage. Dashboard, ledger, catalogue, and dossier surfaces
  intentionally use different compositions while sharing one trust language.
*/
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  ContactRound,
  FileCheck2,
  FileSearch,
  Gavel,
  Heart,
  Home,
  Inbox,
  ListFilter,
  MessageSquareText,
  Newspaper,
  PhoneCall,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  UsersRound,
  Video,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useState } from "react";
import type { ListingDraft } from "@/lib/broker/workflow";
import { demoBrokerSession } from "@/lib/auth/roles";
import { BrokerChannelPanel } from "@/components/broker/BrokerChannelPanel";
import useTitle from "@/hooks/useTitle";

export type AgentSection =
  | "dashboard"
  | "inquiry"
  | "subscriptions"
  | "leads"
  | "channel"
  | "my-listings"
  | "newspaper"
  | "agent-listings"
  | "owner-listings"
  | "ai"
  | "auctions"
  | "tenders"
  | "shortlisted"
  | "contacted"
  | "requirements"
  | "profile";

type NavItem = { section: AgentSection; label: string; icon: typeof Home };
type DeskMeta = { label: string; role: string; intro: string; index: string };

const nav: NavItem[] = [
  { section: "dashboard", label: "Dashboard", icon: Home },
  { section: "inquiry", label: "My inquiry", icon: Inbox },
  { section: "subscriptions", label: "Entitlements", icon: WalletCards },
  { section: "leads", label: "Lead inbox", icon: ContactRound },
  { section: "channel", label: "Broker channel", icon: UsersRound },
  { section: "my-listings", label: "My listings", icon: BriefcaseBusiness },
  { section: "newspaper", label: "Newspaper source", icon: Newspaper },
  { section: "agent-listings", label: "Agent inventory", icon: BriefcaseBusiness },
  { section: "owner-listings", label: "Owner inventory", icon: UserRound },
  { section: "ai", label: "AI suite", icon: Sparkles },
  { section: "auctions", label: "Bank auctions", icon: Gavel },
  { section: "tenders", label: "Property tenders", icon: FileCheck2 },
  { section: "shortlisted", label: "Shortlisted", icon: Heart },
  { section: "contacted", label: "Contact history", icon: PhoneCall },
];

const deskMeta: Record<AgentSection, DeskMeta> = {
  dashboard: { label: "Dashboard", role: "Command spread", intro: "Evidence-led operations for listings, buyer intent, source-aware inventory, and follow-up.", index: "01" },
  inquiry: { label: "My inquiry", role: "Inquiry ledger", intro: "A reviewable ledger for buyer briefs, status changes, consent, and the next accountable action.", index: "02" },
  subscriptions: { label: "Entitlements", role: "Access register", intro: "Every capability is named, scoped, and gated before a provider or payment flow is introduced.", index: "03" },
  leads: { label: "Lead inbox", role: "Lead ledger", intro: "A source-aware lead desk where contact access follows consent, provenance, and organization scope.", index: "04" },
  channel: { label: "Broker channel", role: "Cross-broker exchange", intro: "Publish sanitized demand and supply, match with verified counterparties, and close commission-split deals without exposing customer contact data.", index: "05" },
  "my-listings": { label: "My listings", role: "Submission register", intro: "Manage private drafts and moderated submissions without confusing a draft with public inventory.", index: "06" },
  newspaper: { label: "Newspaper source", role: "Source rail", intro: "A provenance-aware view for properties sourced from newspaper campaigns.", index: "06" },
  "agent-listings": { label: "Agent inventory", role: "Partner rail", intro: "Search the city-scoped partner network while keeping source and contact rights visible.", index: "07" },
  "owner-listings": { label: "Owner inventory", role: "Direct rail", intro: "Direct-owner opportunities with a clear distinction between owner-provided and partner-provided evidence.", index: "08" },
  ai: { label: "AI suite", role: "Capability catalogue", intro: "Automation is useful only when the provider, consent, retention, and budget contracts are explicit.", index: "09" },
  auctions: { label: "Bank auctions", role: "Public-source register", intro: "Separate source documents, reserve prices, EMD terms, and dates from ordinary property listings.", index: "10" },
  tenders: { label: "Property tenders", role: "Deadline register", intro: "A precise surface for issuing departments, submission deadlines, values, and source documents.", index: "11" },
  shortlisted: { label: "Shortlisted", role: "Private working set", intro: "A private shortlist for the agent team, grounded in a legitimate right to work with each property.", index: "12" },
  contacted: { label: "Contact history", role: "Follow-up ledger", intro: "A durable history of property contacts that keeps buyer conversations accountable.", index: "13" },
  requirements: { label: "Requirements", role: "Demand register", intro: "Capture, assign, acknowledge, and close buyer intent without leaking contact data.", index: "14" },
  profile: { label: "Profile", role: "Trust register", intro: "Partner identity, organization verification, and privacy controls remain visible at the point of use.", index: "15" },
};

const sourceMeta: Record<"newspaper" | "agent-listings" | "owner-listings", { title: string; description: string; search: string }> = {
  newspaper: { title: "Newspaper source", description: "A provenance-aware view for properties sourced from newspaper campaigns.", search: "Contact name or contact number" },
  "agent-listings": { title: "Agent inventory", description: "Search the city-scoped partner network while keeping source and contact rights visible.", search: "Project, agent, or contact number" },
  "owner-listings": { title: "Owner inventory", description: "Direct-owner opportunities with a clear distinction between owner-provided and partner-provided evidence.", search: "Project, owner, or contact number" },
};

function DeskRule({ label, detail, tone = "brick" }: { label: string; detail?: string; tone?: "brick" | "trust" }) {
  return <div className={`desk-rule desk-rule-${tone}`}><span className="kicker">{label}</span>{detail ? <span className="stamp desk-rule-detail">{detail}</span> : null}</div>;
}

function EmptyState({ title, body, action, href }: { title: string; body: string; action?: string; href?: string }) {
  return <div className="desk-empty border border-dashed border-ink/20 bg-sand/45 p-8 md:p-10"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-t-full bg-brick/10 text-brick"><Archive size={19} /></span><div><p className="stamp text-brick/70">No live records · source gate</p><h3 className="mt-2 font-display text-2xl font-medium tracking-[-0.02em]">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">{body}</p>{action && href ? <Link href={href} className="mt-5 inline-flex items-center gap-2 stamp !text-[11px] font-semibold text-brick">{action}<ArrowUpRight size={13} /></Link> : null}</div></div></div>;
}

function FilterStrip({ searchLabel = "Search records", fields = ["Listing type", "Property type", "Locality", "Budget", "Area", "Bedrooms"] }: { searchLabel?: string; fields?: string[] }) {
  return <div className="desk-filter border border-ink/12 bg-card p-4 md:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="field-shell flex min-h-11 flex-1 items-center gap-2 border border-ink/12 bg-paper px-3 text-sm text-ink/55 focus-within:border-brick"><Search size={15} /><span className="sr-only">{searchLabel}</span><input aria-label={searchLabel} placeholder={searchLabel} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/40" /></label><div className="flex flex-wrap gap-2">{fields.map((field) => <button key={field} type="button" className="touch-44 inline-flex items-center gap-2 border border-ink/12 px-3 py-2 stamp !text-[10px] font-semibold text-ink/65 hover:border-brick/50 hover:text-brick"><ListFilter size={12} />{field}</button>)}</div><button type="button" className="touch-44 stamp !text-[10px] font-semibold text-brick underline underline-offset-4">Clear</button></div></div>;
}

function TableFrame({ columns, children, tone = "default" }: { columns: string[]; children: React.ReactNode; tone?: "default" | "ledger" }) {
  return <div className={`desk-table ${tone === "ledger" ? "desk-table-ledger" : ""} overflow-x-auto border border-ink/12 bg-card`}><table className="min-w-[760px] w-full text-left text-sm"><thead className="border-b border-ink/10 bg-sand/45"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 stamp !text-[9px] text-ink/55">{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Header({ section }: { section: AgentSection }) {
  const meta = deskMeta[section];
  return <div className="desk-header border-b border-ink/12 bg-sand/65"><div className="container flex flex-col gap-5 py-8 md:flex-row md:items-end md:justify-between"><div><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><p className="kicker text-brick">Partner desk · India coverage</p><span className="stamp text-ink/45">{meta.role} / {meta.index}</span></div><h1 className="display mt-3 text-[clamp(36px,5vw,68px)]">{meta.label}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-ink/60">{meta.intro}</p></div><div className="flex flex-wrap gap-2"><Link href="/broker/listings/new" className="btn-sweep inline-flex min-h-11 items-center gap-2 px-4 stamp !text-[10px] font-semibold text-cream"><Plus size={14} /> Post property</Link><Link href="/requirements" className="inline-flex min-h-11 items-center gap-2 border border-ink/15 px-4 stamp !text-[10px] font-semibold text-brick"><ClipboardList size={14} /> New requirement</Link></div></div></div>;
}

function Sidebar({ section }: { section: AgentSection }) {
  return <aside className="desk-sidebar border-b border-ink/12 bg-paper md:border-b-0 md:border-r"><div className="flex gap-2 overflow-x-auto p-4 md:sticky md:top-24 md:block md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:p-5">{nav.map(({ section: itemSection, label, icon: Icon }) => <Link key={itemSection} href={`/broker/agent/${itemSection === "dashboard" ? "" : itemSection}`} className={`group flex min-w-max items-center gap-2 border px-3 py-2.5 stamp !text-[10px] font-semibold transition md:mb-2 md:w-full ${section === itemSection ? "border-brick bg-brick text-cream" : "border-transparent text-ink/60 hover:border-ink/15 hover:text-brick"}`}><Icon size={14} /><span>{label}</span></Link>)}</div></aside>;
}

function Dashboard({ drafts }: { drafts: ListingDraft[] }) {
  const kpis = [[Inbox, "Total inquiry", "0", "Awaiting a live lead source"], [PhoneCall, "Callback queue", "0", "No scheduled callbacks"], [BriefcaseBusiness, "My properties", String(drafts.length), "Drafts and reviewed submissions"], [CheckCircle2, "Deals closed", "0", "No outcome data recorded"], [CalendarClock, "Scheduled visits", "0", "No visits scheduled"]] as const;
  const quick = nav.filter((item) => !["dashboard", "subscriptions", "profile"].includes(item.section));
  const [primary, ...secondary] = kpis;
  const PrimaryIcon = primary[0];
  return <div className="desk-command-spread"><DeskRule label="Today's signal" detail="INDIA / CITY-SCOPED OPERATIONS" /><div className="mt-5 grid gap-3 xl:grid-cols-6"><article className="desk-kpi desk-kpi-primary border border-ink/12 bg-card p-6 xl:col-span-2"><div className="flex items-start justify-between"><PrimaryIcon size={20} className="text-brick" /><span className="stamp text-brick/70">01 / open</span></div><p className="mt-12 index-num text-7xl">{primary[2]}</p><p className="mt-3 font-display text-2xl font-medium">{primary[1]}</p><p className="mt-2 max-w-[18rem] text-sm leading-6 text-ink/55">{primary[3]}</p><div className="mt-8 border-t border-ink/10 pt-3 stamp text-ink/45">Live source connection required</div></article><div className="grid gap-3 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">{secondary.map(([Icon, label, value, caption], index) => <article key={label} className="desk-kpi border border-ink/12 bg-card p-5"><div className="flex items-start justify-between"><Icon size={18} className="text-brick" /><span className="stamp text-ink/40">0{index + 2}</span></div><p className="mt-7 index-num text-5xl">{value}</p><p className="mt-2 font-medium">{label}</p><p className="mt-1 text-xs leading-5 text-ink/50">{caption}</p></article>)}</div></div><section className="desk-stepwell mt-12"><div className="flex flex-col gap-3 border-b border-ink/12 pb-5 md:flex-row md:items-end md:justify-between"><div><DeskRule label="Next action" detail="SIGNAL → ACTION" /><h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em]">Move from signal to next step.</h2></div><Link href="/broker/listings/new" className="stamp !text-[10px] font-semibold text-brick">Create draft <ArrowUpRight size={12} className="inline" /></Link></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{quick.map(({ section: itemSection, label, icon: Icon }, index) => <Link key={itemSection} href={`/broker/agent/${itemSection}`} className={`desk-action group flex items-center justify-between border border-ink/12 bg-card p-5 motion-lift ${index < 2 ? "lg:col-span-2" : "lg:col-span-1"}`}><span className="flex items-center gap-3"><span className="stamp text-brick/75">0{index + 1}</span><Icon size={17} className="text-brick" /><span className="font-medium">{label}</span></span><ChevronRight size={16} className="text-ink/35 transition group-hover:translate-x-1 group-hover:text-brick" /></Link>)}</div></section><section className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div><div className="flex items-end justify-between"><div><DeskRule label="Submission register" detail={`${drafts.length} drafts`} /><h2 className="mt-3 font-display text-3xl font-medium">My submissions <span className="text-brick">{drafts.length}</span></h2></div><Link href="/broker/listings/new" className="stamp !text-[10px] font-semibold text-brick">New draft</Link></div>{drafts.length === 0 ? <div className="mt-4"><EmptyState title="No drafts yet" body="Your listing drafts will appear here with source, review, and publish status as soon as you create one." action="Start a listing" href="/broker/listings/new" /></div> : <div className="mt-4 space-y-3">{drafts.map((draft) => <article key={draft.id} className="border border-ink/12 bg-card p-5"><div className="flex items-start justify-between gap-4"><h3 className="font-display text-xl font-medium">{draft.title}</h3><span className="stamp bg-sand px-2 py-1 !text-[9px] font-semibold">{draft.status.toLowerCase()}</span></div><p className="mt-2 text-sm text-ink/60">{draft.localitySlug} · {draft.bhk} BHK · {draft.priceInr.toLocaleString("en-IN")}</p></article>)}</div>}</div><aside className="desk-trust-panel border border-ink/12 bg-night p-7 text-cream"><div className="flex items-start justify-between"><ShieldCheck size={22} className="text-ember" /><span className="stamp text-ember/70">TRUST / 04</span></div><p className="mt-10 font-display text-2xl">{demoBrokerSession.organization?.name}</p><p className="mt-2 stamp !text-[10px] text-ember">{demoBrokerSession.organization?.verificationStatus.replaceAll("_", " ")}</p><p className="mt-6 text-sm leading-7 text-cream/65">Every partner action is designed around clear provenance, masked contact, and a reviewable audit trail.</p><div className="mt-7 border-t border-cream/15 pt-4 stamp text-cream/45">INDIA / DIGITAL REVIEW DESK</div><Link href="/guide" className="mt-6 inline-flex items-center gap-2 stamp !text-[10px] font-semibold text-ember">Read verification method <ArrowUpRight size={12} /></Link></aside></section></div>;
}

function LedgerIntro({ label, detail, body }: { label: string; detail: string; body: string }) {
  return <div className="desk-ledger-intro border-l-2 border-brick pl-5"><DeskRule label={label} detail={detail} /><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{body}</p></div>;
}

function Inquiry() {
  return <><LedgerIntro label="Buyer intent" detail="LEDGER / 02" body="Fresh inquiry, follow-up, and all-lead states share one reviewable source trail. Contact access stays behind consent." /><div className="mt-7"><FilterStrip searchLabel="Contact number, name, or lead ID" fields={["Listing type", "Property type", "Locality", "Budget", "Area", "Bedrooms", "Lead source", "Inquiry date"]} /></div><div className="mt-5 flex flex-wrap gap-2">{["Fresh inquiry (0)", "My follow-up (0)", "All leads (0)"].map((tab) => <button key={tab} type="button" className="border border-ink/12 bg-card px-4 py-3 stamp !text-[10px] font-semibold text-ink/65">{tab}</button>)}</div><div className="mt-5"><TableFrame tone="ledger" columns={["Actions", "Lead ID", "Type", "Property", "Locality", "Budget", "Area", "BHK", "Contact", "Source", "Inquiry date"]}><tr><td colSpan={11} className="px-4 py-12 text-center"><EmptyState title="No inquiries yet" body="Fresh, follow-up, and all-lead states will appear here with consent, source, and status history." action="Create a requirement" href="/requirements" /></td></tr></TableFrame></div></>;
}

function Leads() {
  return <><LedgerIntro label="Open demand" detail="LEDGER / 04" body="A lead is not just a row. It is a consented buyer signal with a status, source, freshness, and next action." /><div className="mt-7"><FilterStrip searchLabel="Contact number, name, or inquiry by" fields={["Listing type", "Property type", "Locality", "Budget", "Area", "Bedrooms", "Inquiry date"]} /></div><div className="mt-5 flex items-center justify-between border-b border-ink/12 pb-4"><p className="font-display text-2xl">Open leads <span className="text-brick">0</span></p><span className="stamp text-ink/45">SOURCE + CONSENT REQUIRED</span></div><div className="mt-5"><TableFrame tone="ledger" columns={["Status", "Lead ID", "Type", "Property", "Locality", "Budget", "Area", "Contact", "Inquiry date"]}><tr><td colSpan={9} className="px-4 py-12 text-center"><EmptyState title="No Addressbox-style leads yet" body="Leads will appear with status, consent, source, and contact access history after a live lead source is connected." /></td></tr></TableFrame></div></>;
}

function ListingsSource({ section }: { section: "newspaper" | "agent-listings" | "owner-listings" }) {
  const meta = sourceMeta[section];
  return <><LedgerIntro label="Inventory source" detail={`RAIL / ${deskMeta[section].index}`} body={meta.description} /><div className="mt-7"><FilterStrip searchLabel={meta.search} fields={["Listing type", "Property type", "Locality", "Budget", "Area", "Bedrooms", "Posted date"]} /></div><div className="mt-5"><TableFrame columns={["Status", "Property ID", "Type", "Property type", "Locality", "Price", "Area", "BHK", "Project", section === "newspaper" ? "Contact" : section === "agent-listings" ? "Agent" : "Owner", "Posted"]}><tr><td colSpan={11} className="px-4 py-12 text-center"><EmptyState title={`No ${meta.title.toLowerCase()} rows`} body="No records are available for this account and filter set. Connect an approved inventory source before presenting live contact details." /></td></tr></TableFrame></div></>;
}

function MyListings({ drafts }: { drafts: ListingDraft[] }) {
  return <><LedgerIntro label="Your source records" detail="REGISTER / 05" body="Manage your own source records from draft to review to publish. Public visibility only follows moderation and evidence checks." /><div className="mt-7 flex items-center justify-between gap-4"><p className="max-w-xl text-sm leading-6 text-ink/60">The listing dossier keeps media rights, RERA context, locality, price, and description attached to the same reviewable submission.</p><Link href="/broker/listings/new" className="btn-sweep inline-flex min-h-11 items-center gap-2 px-4 stamp !text-[10px] font-semibold text-cream"><Plus size={14} /> Post property</Link></div><div className="mt-6"><FilterStrip searchLabel="Project name" fields={["Listing type", "Property type", "Locality", "Budget", "Area", "Bedrooms", "Status", "Posted date"]} /></div><div className="mt-5"><TableFrame columns={["Action", "Property ID", "Type", "Property type", "Locality", "Price", "Area", "BHK", "Project", "Status", "Posted"]}>{drafts.length ? drafts.map((draft) => <tr key={draft.id} className="border-t border-ink/10"><td className="px-4 py-4"><Link className="stamp !text-[10px] font-semibold text-brick" href="/admin/moderation/listings">Review</Link></td><td className="px-4 py-4 font-mono text-xs">{draft.id}</td><td className="px-4 py-4">Sell</td><td className="px-4 py-4">Residential</td><td className="px-4 py-4">{draft.localitySlug}</td><td className="px-4 py-4">₹{draft.priceInr.toLocaleString("en-IN")}</td><td className="px-4 py-4">—</td><td className="px-4 py-4">{draft.bhk}</td><td className="px-4 py-4">{draft.title}</td><td className="px-4 py-4"><span className="stamp bg-sand px-2 py-1 !text-[9px]">{draft.status.toLowerCase()}</span></td><td className="px-4 py-4">—</td></tr>) : <tr><td colSpan={11} className="px-4 py-12 text-center"><EmptyState title="No properties yet" body="Start with the five-step listing wizard. Drafts remain private until your evidence and moderation checks are complete." action="Create property draft" href="/broker/listings/new" /></td></tr>}</TableFrame></div></>;
}


function AiSuite() {
  const cards = [{ icon: PhoneCall, title: "AI voice qualification", body: "Qualify consented leads, capture buyer preferences, and schedule callbacks." }, { icon: Video, title: "Property video studio", body: "Build a structured media brief from approved listing images and narration." }, { icon: MessageSquareText, title: "Bulk messages", body: "Segmented SMS or WhatsApp campaigns with opt-out and delivery audit." }, { icon: Bot, title: "Listing chatbot", body: "Answer questions from verified listing facts and hand off qualified demand." }];
  return <div className="desk-catalogue"><div className="desk-stepwell desk-gate border border-ember/30 bg-ember/10 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><DeskRule label="Provider gate" detail="CATALOGUE / 09" /><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/75">AI calls, video generation, messaging, and chatbot delivery remain disabled until an approved provider, consent policy, retention policy, and usage budget are configured.</p></div><span className="stamp border border-brick/20 bg-paper/40 px-3 py-2 text-brick">4 contracts open</span></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">{cards.map(({ icon: Icon, title, body }, index) => <article key={title} className={`desk-capability border border-ink/12 bg-card p-6 ${index === 0 ? "md:col-span-2" : ""}`}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="stamp text-brick/70">0{index + 1}</span><Icon size={22} className="text-brick" /></div><span className="stamp bg-sand px-2 py-1 !text-[9px] font-semibold">gated</span></div><h2 className="mt-8 font-display text-2xl font-medium">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">{body}</p><div className="mt-7 border-t border-ink/10 pt-3 stamp text-ink/45">Provider · consent · retention · budget</div></article>)}</div></div>;
}

function Auctions() { return <><LedgerIntro label="Public source" detail="REGISTER / 10" body="Bank auction records need a source document, bank provenance, reserve price, EMD, and auction dates before they can be shown." /><div className="mt-7"><FilterStrip searchLabel="Bank property ID" fields={["Property type", "Locality", "Budget", "Area", "Auction date"]} /></div><div className="mt-5"><TableFrame columns={["Status", "Bank property ID", "Property type", "Reserve price", "EMD", "Locality", "Bank", "Project", "EMD end", "Auction start", "Auction end"]}><tr><td colSpan={11} className="px-4 py-12 text-center"><EmptyState title="No auction records" body="Auction rows remain separate from ordinary listings until an approved public source and document review path are connected." /></td></tr></TableFrame></div></>; }

function Tenders() { return <><LedgerIntro label="Public deadline" detail="REGISTER / 11" body="Tender cards will show issuing department, submission deadline, value, source document, and location once an approved public-data source is connected." /><div className="mt-7"><FilterStrip searchLabel="Tender ID or relevant words" fields={["City", "Submission end date", "Department", "Tender value"]} /></div><div className="mt-5 flex items-center justify-between border-b border-ink/12 pb-4"><p className="font-display text-2xl">Active tenders <span className="text-brick">0</span></p><span className="stamp text-ink/45">DEADLINE REGISTER</span></div><div className="mt-5"><EmptyState title="No active tenders" body="The tender surface is ready for source-backed records, not speculative or scraped deadlines." /></div></>; }

function Shortlisted({ contacted = false }: { contacted?: boolean }) { return <><LedgerIntro label={contacted ? "Follow-up history" : "Private working set"} detail={contacted ? "LEDGER / 13" : "SET / 12"} body={contacted ? "A durable history of property contacts keeps follow-up accountable and separates a viewed listing from an actual buyer conversation." : "Save only properties you have a legitimate right to work with. A shortlist is private until an explicit sharing action occurs."} /><div className="mt-6"><TableFrame tone="ledger" columns={contacted ? ["Type", "Listing", "Property", "Location", "Price", "Contact", "Contacted date", "Action"] : ["Type", "Listing", "Property", "Location", "Price", "Details", "Shortlisted date", "Action"]}><tr><td colSpan={8} className="px-4 py-12 text-center"><EmptyState title={contacted ? "No contact history" : "No shortlisted properties"} body={contacted ? "Contacted records will appear only after an explicit, consented contact action and will remain scoped to this workspace." : "Your shortlist is empty. Use the heart action on an eligible listing to save it here."} /></td></tr></TableFrame></div></>; }

function Requirements() { return <><LedgerIntro label="Demand register" detail="CONTROL / 14" body="Requirement briefs are scoped to their owner or organization, retain consent text, and never expose a phone number until the relevant consent step succeeds." /><div className="mt-7 grid gap-4 md:grid-cols-3"><article className="border border-ink/12 bg-card p-6"><Tag size={20} className="text-brick" /><h2 className="mt-5 font-display text-2xl">Buy or rent brief</h2><p className="mt-3 text-sm leading-6 text-ink/60">Capture intent, category, locality, budget, area, bedrooms, role, and timing.</p><Link href="/requirements" className="mt-6 inline-flex items-center gap-2 stamp !text-[10px] font-semibold text-brick">Open brief <ArrowUpRight size={12} /></Link></article><article className="border border-ink/12 bg-card p-6"><UsersRound size={20} className="text-brick" /><h2 className="mt-5 font-display text-2xl">Team follow-up</h2><p className="mt-3 text-sm leading-6 text-ink/60">Assign, acknowledge, reply, close, and audit every requirement without leaking contact data.</p></article><article className="border border-trust/25 bg-trust/10 p-6"><Settings2 size={20} className="text-trust" /><h2 className="mt-5 font-display text-2xl">Manage consent</h2><p className="mt-3 text-sm leading-6 text-ink/60">Revoke, delete, or restrict a requirement when the consent or purpose changes.</p></article></div><div className="mt-6"><EmptyState title="No saved requirements" body="Requirements created through the public brief will appear here after the authenticated persistence source is enabled." action="Create a requirement" href="/requirements" /></div></>; }

function Subscriptions() { return <><LedgerIntro label="Access register" detail="REGISTER / 03" body="Phase 1 keeps partner access explicit: free workflow surfaces are available for development, while provider-backed capabilities stay gated." /><div className="mt-7 grid gap-4 md:grid-cols-3"><article className="border border-ink/12 bg-card p-6"><WalletCards size={20} className="text-brick" /><p className="mt-5 stamp !text-[10px] text-ink/55">Current plan</p><h2 className="mt-2 font-display text-2xl">Free partner preview</h2><p className="mt-3 text-sm leading-6 text-ink/60">Core drafts, evidence review, and masked lead contracts remain available for development and testing.</p></article><article className="border border-ink/12 bg-sand/55 p-6"><CircleDollarSign size={20} className="text-brick" /><p className="mt-5 stamp !text-[10px] text-ink/55">Gated capability</p><h2 className="mt-2 font-display text-2xl">AI and campaign tools</h2><p className="mt-3 text-sm leading-6 text-ink/60">Requires approved providers, consent handling, and a usage budget. No payment flow is enabled in Phase 1.</p></article><article className="border border-ink/12 bg-night p-6 text-cream"><ShieldCheck size={20} className="text-ember" /><p className="mt-5 stamp !text-[10px] text-cream/55">No surprise access</p><h2 className="mt-2 font-display text-2xl">Entitlements stay explicit.</h2><p className="mt-3 text-sm leading-6 text-cream/60">A locked feature explains why it is unavailable instead of silently failing or collecting payment.</p></article></div></>; }

function Profile() { return <><LedgerIntro label="Trust register" detail="IDENTITY / 15" body="Partner identity, organization verification, and privacy controls remain visible at the point where a broker takes action." /><div className="mt-7 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]"><aside className="desk-trust-panel border border-ink/12 bg-night p-7 text-cream"><UserRound size={22} className="text-ember" /><p className="mt-6 font-display text-2xl">{demoBrokerSession.user.name}</p><p className="mt-2 stamp !text-[10px] text-ember">{demoBrokerSession.user.role.replaceAll("_", " ")}</p><p className="mt-6 text-sm leading-7 text-cream/65">{demoBrokerSession.organization?.name} · {demoBrokerSession.organization?.verificationStatus.replaceAll("_", " ")}</p><div className="mt-8 border-t border-cream/15 pt-4 stamp text-cream/45">INDIA / PARTNER IDENTITY</div></aside><div className="border border-ink/12 bg-card p-7"><DeskRule label="Account controls" detail="SAFE / SERVER-SIDE" /><div className="mt-5 space-y-4"><div className="flex items-start gap-3 border-b border-ink/10 pb-4"><ShieldCheck size={18} className="text-trust" /><div><p className="font-medium">Verified partner access</p><p className="mt-1 text-sm text-ink/60">Authorization remains server-side and organization scoped.</p></div></div><div className="flex items-start gap-3 border-b border-ink/10 pb-4"><FileSearch size={18} className="text-brick" /><div><p className="font-medium">Evidence review</p><p className="mt-1 text-sm text-ink/60">Listings move through moderation before public visibility.</p></div></div><div className="flex items-start gap-3"><Settings2 size={18} className="text-brick" /><div><p className="font-medium">Privacy and consent</p><p className="mt-1 text-sm text-ink/60">Masked contact and revocation controls stay part of the workflow.</p></div></div></div></div></div></>; }

export default function AgentWorkspace({ section = "dashboard" }: { section?: AgentSection }) {
  useTitle(`Agent workspace · ${section}`);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const loadDrafts = useCallback(async () => { try { const response = await fetch("/api/broker/listings", { cache: "no-store" }); const payload = await response.json(); setDrafts(Array.isArray(payload.drafts) ? payload.drafts : []); } catch { setDrafts([]); } }, []);
  useEffect(() => { void loadDrafts(); }, [loadDrafts]);
  const body = useMemo(() => {
    if (section === "dashboard") return <Dashboard drafts={drafts} />;
    if (section === "inquiry") return <Inquiry />;
    if (section === "subscriptions") return <Subscriptions />;
    if (section === "leads") return <Leads />;
    if (section === "channel") return <BrokerChannelPanel drafts={drafts} />;
    if (section === "my-listings") return <MyListings drafts={drafts} />;
    if (section === "newspaper" || section === "agent-listings" || section === "owner-listings") return <ListingsSource section={section} />;
    if (section === "ai") return <AiSuite />;
    if (section === "auctions") return <Auctions />;
    if (section === "tenders") return <Tenders />;
    if (section === "shortlisted") return <Shortlisted />;
    if (section === "contacted") return <Shortlisted contacted />;
    if (section === "requirements") return <Requirements />;
    return <Profile />;
  }, [drafts, section]);
  return <div className={`page-transition desk-page desk-page-${section} bg-paper pt-[78px] text-ink`}><Header section={section} /><div className="container grid md:grid-cols-[220px_minmax(0,1fr)]"><Sidebar section={section} /><main className="min-w-0 py-8 md:px-8 md:py-12">{body}</main></div></div>;
}
