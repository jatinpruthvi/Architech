"use client";
/* India-wide requirement drawer: a calm, evidence-first alternative to a generic lead form. */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, Check, X } from "lucide-react";
import type { RequirementCategory, RequirementInput, RequirementIntent, RequirementRole } from "@/lib/requirements";
import { intentLabel, intentsForRole, isSupplyIntent } from "@/lib/requirements";
import { useSession } from "@/contexts/SessionContext";
import { getCities } from "@/lib/repositories/cities";
import { getLocalities } from "@/lib/repositories/localities";
const categories: Array<{ value: RequirementCategory; label: string; subtypes: string[] }> = [
  { value: "residential", label: "Homes", subtypes: ["Flat/Apartment", "Villa"] },
  { value: "commercial", label: "Commercial", subtypes: ["Office", "Shop"] },
  { value: "pg", label: "PG / Co-living", subtypes: ["PG/Co-living"] },
  { value: "plot", label: "Plot", subtypes: ["Plot"] },
  { value: "land", label: "Land", subtypes: ["Land"] },
  { value: "auction", label: "Bank auction", subtypes: ["Bank Auction"] },
];

/* Role comes FIRST in the form, because it decides which intents are even
   offered: an owner is never "buying" here, and a tenant never "selling". The
   old form asked buy-or-rent up front and assumed everyone was demand-side. */
const roles: Array<{ value: RequirementRole; label: string }> = [
  { value: "buyer", label: "Buyer" },
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "agent", label: "Agent" },
  { value: "builder", label: "Builder" },
];

type Props = { compact?: boolean };

type FormState = Omit<RequirementInput, "idempotencyKey">;

const cities = getCities();

const initialForm: FormState = {
  intent: "buy",
  citySlug: "",
  category: "residential",
  subtype: "Flat/Apartment",
  localitySlugs: [],
  role: "buyer",
  name: "",
  phone: "",
  consentText: "I agree that Architech may contact me about this requirement.",
};

export default function RequirementCapture({ compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const { session } = useSession();

  const selectedCategory = useMemo(() => categories.find((item) => item.value === form.category) ?? categories[0], [form.category]);
  const availableLocalities = useMemo(() => form.citySlug ? getLocalities(form.citySlug) : [], [form.citySlug]);
  /* Which options this person actually has, derived from their role rather
     than hardcoded. Keeps the form and the server contract from drifting. */
  const availableIntents = useMemo(() => intentsForRole(form.role), [form.role]);
  const listingOwnProperty = isSupplyIntent(form.intent);

  /* Prefill the number they already verified at sign-up instead of asking for
     it again. Only fills an EMPTY field, so it never overwrites a correction
     the person made, and only while the dialog is open so a late-arriving
     session does not rewrite the field under the cursor. */
  const sessionPhone = session?.user.phoneE164;
  useEffect(() => {
    if (!open || !sessionPhone) return;
    setForm((current) => (current.phone.trim() ? current : { ...current, phone: sessionPhone }));
  }, [open, sessionPhone]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setStatus("idle");
    setErrors([]);
    setForm((current) => ({ ...current, [key]: value }));
  };

  /* Changing role can invalidate the current intent (a tenant cannot sell), so
     both move together. Leaving a stale intent would submit a combination the
     server rejects, with an error the person cannot act on. */
  const changeRole = (role: RequirementRole) => {
    setStatus("idle");
    setErrors([]);
    setForm((current) => {
      const allowed = intentsForRole(role);
      const intent = allowed.includes(current.intent) ? current.intent : allowed[0];
      // Listing a property means ONE locality; drop extra ticks rather than
      // submitting an address that does not exist.
      const localitySlugs = isSupplyIntent(intent) ? current.localitySlugs.slice(0, 1) : current.localitySlugs;
      return { ...current, role, intent, localitySlugs };
    });
  };

  const changeIntent = (intent: RequirementIntent) => {
    setStatus("idle");
    setErrors([]);
    setForm((current) => ({
      ...current,
      intent,
      localitySlugs: isSupplyIntent(intent) ? current.localitySlugs.slice(0, 1) : current.localitySlugs,
    }));
  };

  const toggleLocality = (slug: string, checked: boolean) => {
    setStatus("idle");
    setErrors([]);
    setForm((current) => {
      if (isSupplyIntent(current.intent)) {
        // Single-select: the property is in exactly one of these.
        return { ...current, localitySlugs: checked ? [slug] : [] };
      }
      return {
        ...current,
        localitySlugs: checked
          ? [...current.localitySlugs, slug]
          : current.localitySlugs.filter((item) => item !== slug),
      };
    });
  };

  const changeCity = (citySlug: string) => {
    const firstLocality = getLocalities(citySlug)[0]?.slug;
    setStatus("idle");
    setErrors([]);
    // Reset locality choices atomically: retaining a previous city's slug would
    // create a cross-city requirement even if the old checkbox is no longer visible.
    setForm((current) => ({ ...current, citySlug, localitySlugs: firstLocality ? [firstLocality] : [] }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.citySlug || form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 8 || form.localitySlugs.length === 0) {
      setErrors([listingOwnProperty
        ? "Choose the city and the locality your property is in, then add your name and an 8-digit phone number."
        : "Choose a city and locality, then add your name and an 8-digit phone number."]);
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrors([]);
    try {
      const response = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /* No client-built idempotency key. The old one interpolated the raw
           phone number, which then travelled to the server, was persisted, and
           came back in the response body. The server derives the key itself
           (hashed, and scoped to the signed-in account when there is one),
           which is both more private and more correct. */
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { ok?: boolean; errors?: string[] };
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") || "We could not save that requirement.");
      setStatus("success");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "We could not save that requirement."]);
      setStatus("error");
    }
  };

  const triggerClass = compact
    ? "hidden border border-ember/40 px-4 py-2.5 stamp !text-[10px] font-semibold text-ember transition-colors hover:border-ember hover:bg-ember/10 lg:inline-flex"
    : "clay-fill btn-primary inline-flex items-center gap-2 border border-white/15 bg-brick px-5 py-3 stamp !text-[11px] font-semibold text-cream transition-transform hover:-translate-y-0.5";

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => { setOpen(true); setStatus("idle"); }} aria-haspopup="dialog">
        {compact ? "Tell us what you need" : <>Tell us what you need <ArrowUpRight size={14} /></>}
      </button>
      {/* Radix Dialog, i.e. the SAME primitive the listing's lead form already
          uses. The hand-rolled version this replaces had an Escape listener and
          a scroll lock but NO focus trap: focus escaped to the page behind an
          `aria-modal="true"` surface, and a keyboard user could tab into
          invisible controls and act on them without seeing it. That is not a
          styling gap — `aria-modal` tells a screen reader the rest of the
          document is gone, so the old markup promised something it did not do.
          Radix also owns focus restore, `inert`-style outside-click, and the
          scroll lock, so the effect block below is gone with it. */}
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setStatus("idle"); }}>
        <DialogContent
          showCloseButton={false}
          aria-describedby="requirement-desc"
          onOpenAutoFocus={(event) => {
            /* Focus the FIRST FIELD, not the sheet: Radix's default lands on the
               container, and a dialog whose whole job is one short brief should
               have the cursor in it. Held to a rAF because Radix measures the
               panel in the same commit that mounts it. */
            event.preventDefault();
            requestAnimationFrame(() => {
              const first = document.getElementById("requirement-name");
              if (first instanceof HTMLInputElement) { first.focus(); first.select(); }
            });
          }}
          className={`vh-sheet w-full max-w-3xl gap-0 overflow-y-auto border-t-2 border-brick bg-paper p-0 text-ink editorial-shadow sm:border sm:border-ink/15 ${compact ? "" : "sm:max-w-3xl"}`}
        >
          <div className="flex items-start justify-between gap-6 border-b border-ink/12 p-5 md:p-8">
            <div>
              <p className="kicker text-brick">A better brief · India-wide city scope</p>
              {/* Radix warns loudly when a dialog has no Title/Description; using
                  its components here (rather than aria-labelledby at a distance)
                  is what makes `aria-modal` a statement of fact. */}
              <DialogTitle className="display mt-3 text-[clamp(30px,5vw,52px)]">Tell us the place you are <em className="text-brick">looking for.</em></DialogTitle>
              <DialogDescription id="requirement-desc" className="mt-3 max-w-xl text-sm leading-6 text-ink/65">Share the shape of your search once. Our partner network can reply without exposing your number by default.</DialogDescription>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center border border-ink/15 text-ink/70 hover:border-brick hover:text-brick" aria-label="Close requirement form"><X size={18} /></button>
          </div>
            {status === "success" ? (
              <div className="p-8 md:p-12">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-trust text-cream"><Check size={23} /></div>
                <h3 className="display mt-6 text-4xl">Brief received.</h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-ink/65">We have recorded your requirement with masked contact details. A verified Architech partner can follow up after review.</p>
                <button type="button" onClick={() => setOpen(false)} className="night-fill mt-7 bg-night px-5 py-3 stamp !text-[11px] font-semibold text-cream">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-7 p-5 md:grid-cols-2 md:p-8">
                {/* Role first: it decides which intents are even offered, so
                    asking "buy or rent?" before knowing who is asking was what
                    left an owner with no honest option. */}
                <fieldset className="md:col-span-2">
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">I am a</legend>
                  <div className="mt-2 flex flex-wrap gap-2">{roles.map((role) => <button key={role.value} type="button" onClick={() => changeRole(role.value)} aria-pressed={form.role === role.value} className={`border px-3 py-2 stamp !text-[10px] font-semibold transition-colors ${form.role === role.value ? "border-brick bg-brick text-cream" : "border-ink/15 hover:border-brick hover:text-brick"}`}>{role.label}</button>)}</div>
                </fieldset>
                <fieldset className="md:col-span-2">
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">I want to</legend>
                  <div className={`mt-2 grid gap-2 ${availableIntents.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {availableIntents.map((intent) => (
                      <button key={intent} type="button" onClick={() => changeIntent(intent)} aria-pressed={form.intent === intent} className={`border px-4 py-3 text-left stamp !text-[11px] font-semibold transition-colors ${form.intent === intent ? "border-brick bg-brick text-cream" : "border-ink/15 hover:border-brick hover:text-brick"}`}>{intentLabel(intent)}</button>
                    ))}
                  </div>
                </fieldset>
                <label className="stamp !text-[10px] font-semibold text-ink/60">City
                  <select required value={form.citySlug} onChange={(event) => changeCity(event.target.value)} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none">
                    <option value="" disabled>Select a city</option>
                    {cities.map((city) => <option key={city.slug} value={city.slug}>{city.name}, {city.state}</option>)}
                  </select>
                </label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Property category
                  <select value={form.category} onChange={(event) => { const category = event.target.value as RequirementCategory; update("category", category); update("subtype", categories.find((item) => item.value === category)?.subtypes[0] ?? "Flat/Apartment"); }} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none">{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
                </label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Subtype
                  <select value={form.subtype} onChange={(event) => update("subtype", event.target.value)} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none">{selectedCategory.subtypes.map((subtype) => <option key={subtype}>{subtype}</option>)}</select>
                </label>
                {/* A buyer may prefer several areas; a property sits in exactly
                    one, so listing switches to a single choice rather than
                    inviting an address that does not exist. */}
                <fieldset>
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">{listingOwnProperty ? "Locality of your property" : "Preferred localities"}</legend>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">{availableLocalities.map((locality) => <label key={`${locality.citySlug}:${locality.slug}`} className="flex min-h-9 items-center gap-2 text-sm text-ink/75"><input type={listingOwnProperty ? "radio" : "checkbox"} name={listingOwnProperty ? "requirement-locality" : undefined} checked={form.localitySlugs.includes(locality.slug)} onChange={(event) => toggleLocality(locality.slug, event.target.checked)} className="h-4 w-4 accent-[#b8472e]" />{locality.name}</label>)}</div>
                  <p className="mt-2 text-xs leading-5 ink-3">{listingOwnProperty ? "Not listed? Choose the nearest one — you can give the exact address later." : "Pick every area you would consider. Leave one out and we will not send it to you."}</p>
                </fieldset>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Name<input id="requirement-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink placeholder:text-ink/35 focus:border-brick focus:outline-none" /></label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Mobile number<input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 00000 00000" inputMode="tel" className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink placeholder:text-ink/35 focus:border-brick focus:outline-none" />{sessionPhone && form.phone === sessionPhone ? <span className="mt-1 block text-xs font-normal normal-case tracking-normal ink-3">Your verified number. Edit it if this requirement needs a different one.</span> : null}</label>
                <label className="flex gap-3 text-xs leading-5 text-ink/60 md:col-span-2"><input type="checkbox" required className="mt-1 h-4 w-4 accent-[#b8472e]" defaultChecked />I agree that Architech may contact me about this requirement. Contact is masked by default and can be revoked.</label>
                {errors.length > 0 && <p role="alert" className="border border-brick/30 bg-brick/5 p-3 text-sm text-brick md:col-span-2">{errors.join(" ")}</p>}
                <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between"><p className="stamp !text-[9px] text-ink/50">No payment. No public phone number. Demo routing until production partners are connected.</p><button type="submit" disabled={status === "submitting"} className="clay-fill btn-solid btn-primary border border-white/15 bg-brick px-6 py-3 stamp !text-[11px] font-semibold text-cream">{status === "submitting" ? "Saving…" : "Send my requirement"}</button></div>
              </form>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
