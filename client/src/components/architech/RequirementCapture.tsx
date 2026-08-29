"use client";
/* Amdavad Modern requirement drawer: a calm, evidence-first alternative to a generic lead form. */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, Check, X } from "lucide-react";
import type { RequirementCategory, RequirementInput, RequirementIntent, RequirementRole } from "@/lib/requirements";


const localities = ["Paldi", "Navrangpura", "Prahlad Nagar", "Thaltej", "Bopal", "Satellite"];
const categories: Array<{ value: RequirementCategory; label: string; subtypes: string[] }> = [
  { value: "residential", label: "Homes", subtypes: ["Flat/Apartment", "Villa"] },
  { value: "commercial", label: "Commercial", subtypes: ["Office", "Shop"] },
  { value: "pg", label: "PG / Co-living", subtypes: ["PG/Co-living"] },
  { value: "plot", label: "Plot", subtypes: ["Plot"] },
  { value: "land", label: "Land", subtypes: ["Land"] },
  { value: "auction", label: "Bank auction", subtypes: ["Bank Auction"] },
];

const roles: Array<{ value: RequirementRole; label: string }> = [
  { value: "buyer", label: "Buyer" },
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "agent", label: "Agent" },
  { value: "builder", label: "Builder" },
];

type Props = { compact?: boolean };

type FormState = Omit<RequirementInput, "idempotencyKey">;

const initialForm: FormState = {
  intent: "buy",
  city: "ahmedabad",
  category: "residential",
  subtype: "Flat/Apartment",
  localities: ["Paldi"],
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

  const selectedCategory = useMemo(() => categories.find((item) => item.value === form.category) ?? categories[0], [form.category]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setStatus("idle");
    setErrors([]);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 8 || form.localities.length === 0) {
      setErrors(["Add your name, an 8-digit phone number, and at least one preferred locality."]);
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrors([]);
    try {
      const response = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idempotencyKey: `${form.phone}:${form.intent}:${form.category}:${form.localities.join(",")}` }),
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
    : "inline-flex items-center gap-2 bg-brick px-5 py-3 stamp !text-[11px] font-semibold text-cream transition-transform hover:-translate-y-0.5";

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
              <p className="kicker text-brick">A better brief · Ahmedabad first</p>
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
                <fieldset className="md:col-span-2">
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">I want to</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["buy", "rent"] as RequirementIntent[]).map((intent) => (
                      <button key={intent} type="button" onClick={() => update("intent", intent)} className={`border px-4 py-3 text-left stamp !text-[11px] font-semibold transition-colors ${form.intent === intent ? "border-brick bg-brick text-cream" : "border-ink/15 hover:border-brick hover:text-brick"}`}>{intent === "buy" ? "Buy a place" : "Rent a place"}</button>
                    ))}
                  </div>
                </fieldset>
                <label className="stamp !text-[10px] font-semibold text-ink/60">City
                  <select value={form.city} onChange={(event) => update("city", event.target.value as FormState["city"])} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none"><option value="ahmedabad">Ahmedabad</option><option value="gandhinagar">Gandhinagar</option></select>
                </label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Property category
                  <select value={form.category} onChange={(event) => { const category = event.target.value as RequirementCategory; update("category", category); update("subtype", categories.find((item) => item.value === category)?.subtypes[0] ?? "Flat/Apartment"); }} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none">{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
                </label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Subtype
                  <select value={form.subtype} onChange={(event) => update("subtype", event.target.value)} className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink focus:border-brick focus:outline-none">{selectedCategory.subtypes.map((subtype) => <option key={subtype}>{subtype}</option>)}</select>
                </label>
                <fieldset>
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">Preferred localities</legend>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">{localities.map((locality) => <label key={locality} className="flex min-h-9 items-center gap-2 text-sm text-ink/75"><input type="checkbox" checked={form.localities.includes(locality)} onChange={(event) => update("localities", event.target.checked ? [...form.localities, locality] : form.localities.filter((item) => item !== locality))} className="h-4 w-4 accent-[#b8472e]" />{locality}</label>)}</div>
                </fieldset>
                <fieldset className="md:col-span-2">
                  <legend className="stamp !text-[10px] font-semibold text-ink/60">I am a</legend>
                  <div className="mt-2 flex flex-wrap gap-2">{roles.map((role) => <button key={role.value} type="button" onClick={() => update("role", role.value)} className={`border px-3 py-2 stamp !text-[10px] font-semibold transition-colors ${form.role === role.value ? "border-brick bg-brick text-cream" : "border-ink/15 hover:border-brick hover:text-brick"}`}>{role.label}</button>)}</div>
                </fieldset>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Name<input id="requirement-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink placeholder:text-ink/35 focus:border-brick focus:outline-none" /></label>
                <label className="stamp !text-[10px] font-semibold text-ink/60">Mobile number<input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 00000 00000" inputMode="tel" className="mt-2 h-12 w-full border border-ink/20 bg-paper px-3 text-sm text-ink placeholder:text-ink/35 focus:border-brick focus:outline-none" /></label>
                <label className="flex gap-3 text-xs leading-5 text-ink/60 md:col-span-2"><input type="checkbox" required className="mt-1 h-4 w-4 accent-[#b8472e]" defaultChecked />I agree that Architech may contact me about this requirement. Contact is masked by default and can be revoked.</label>
                {errors.length > 0 && <p role="alert" className="border border-brick/30 bg-brick/5 p-3 text-sm text-brick md:col-span-2">{errors.join(" ")}</p>}
                <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between"><p className="stamp !text-[9px] text-ink/50">No payment. No public phone number. Demo routing until production partners are connected.</p><button type="submit" disabled={status === "submitting"} className="clay-fill btn-solid bg-brick px-6 py-3 stamp !text-[11px] font-semibold text-cream">{status === "submitting" ? "Saving…" : "Send my requirement"}</button></div>
              </form>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
