"use client";
/* Broker listing-draft submission form.
   Captures the fields enforced by the `/api/broker/listings` contract, POSTs a
   draft, then lets the broker submit it for review (source trail + media-rights
   gate). Validation and status feedback are shown inline; the moderation queue
   reads the same persisted drafts. */
import { ArrowUpRight, CheckCircle2, FileCheck2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useTitle from "@/hooks/useTitle";
import { getLocalities } from "@/lib/repositories";
import type { ListingDraftInput } from "@/lib/broker/workflow";
import { AVAILABILITY_OPTIONS, PROPERTY_TYPE_OPTIONS } from "@/lib/listing-vocabulary";
import type { SignedMediaUpload } from "@/lib/media/upload";

const EMPTY: ListingDraftInput = {
  title: "",
  localitySlug: "paldi",
  priceInr: 0,
  bhk: 2,
  areaSqft: 0,
  propertyType: "APARTMENT",
  availability: "READY_TO_MOVE",
  description: "",
  reraNumber: "",
  mediaRightsConfirmed: false,
};

export default function ListingSubmission() {
  useTitle("New listing draft");
  const localities = getLocalities();
  const [draft, setDraft] = useState<ListingDraftInput>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaLicenseEvidence, setMediaLicenseEvidence] = useState("");
  const [mediaRightsConfirmed, setMediaRightsConfirmed] = useState(false);
  const [mediaUpload, setMediaUpload] = useState<SignedMediaUpload | null>(null);
  const [mediaSubmitting, setMediaSubmitting] = useState(false);

  useEffect(() => () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
  }, [mediaPreviewUrl]);

  const completion = useMemo(() => {
    const checks = [
      { label: "Title", complete: draft.title.trim().length >= 8 },
      { label: "Price", complete: Number.isFinite(draft.priceInr) && draft.priceInr > 0 },
      { label: "Area", complete: Number.isFinite(draft.areaSqft) && draft.areaSqft >= 150 },
      { label: "Availability", complete: draft.availability.trim().length >= 3 },
      { label: "Description", complete: draft.description.trim().length >= 30 },
      { label: "Media rights", complete: draft.mediaRightsConfirmed },
    ];
    return { checks, complete: checks.filter((check) => check.complete).length, total: checks.length };
  }, [draft]);

  const set = (key: keyof ListingDraftInput, value: string | number | boolean) => setDraft((current) => ({ ...current, [key]: value }));

  const onMediaFile = (file: File | null) => {
    setMediaUpload(null);
    setMediaFile(file);
    setMediaPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const prepareMediaUpload = async () => {
    if (!draftId || !mediaFile) {
      setErrors(["Create the listing draft before attaching media."]);
      return;
    }
    if (mediaLicenseEvidence.trim().length < 10) {
      setErrors(["Media license evidence must be at least 10 characters."]);
      return;
    }
    if (!mediaRightsConfirmed) {
      setErrors(["Confirm media rights before attaching this file."]);
      return;
    }
    setMediaSubmitting(true);
    setErrors([]);
    try {
      const signResponse = await fetch("/api/media/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingDraftId: draftId,
          fileName: mediaFile.name,
          mimeType: mediaFile.type,
          sizeBytes: mediaFile.size,
          licenseEvidence: mediaLicenseEvidence,
          rightsConfirmed: mediaRightsConfirmed,
        }),
      });
      const signedPayload = await signResponse.json();
      if (!signResponse.ok || !signedPayload.ok) throw new Error(signedPayload.errors?.join(" ") ?? "Could not prepare the media packet.");
      let upload = signedPayload.upload as SignedMediaUpload;
      const hasRealStorage = upload.storageProvider === "cloudflare-r2" && !upload.uploadUrl.includes("placeholder");
      if (hasRealStorage) {
        const transferResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.requiredHeaders, body: mediaFile });
        if (!transferResponse.ok) throw new Error(`Storage upload failed (${transferResponse.status}).`);
        const completeResponse = await fetch(`/api/media/uploads/${encodeURIComponent(upload.id)}/complete`, { method: "POST" });
        const completePayload = await completeResponse.json();
        if (!completeResponse.ok || !completePayload.ok) throw new Error(completePayload.errors?.join(" ") ?? "Could not complete the media packet.");
        upload = completePayload.upload as SignedMediaUpload;
      }
      const attachResponse = await fetch(`/api/broker/listings/${encodeURIComponent(draftId)}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: upload.id, action: "attach" }),
      });
      const attachPayload = await attachResponse.json();
      if (!attachResponse.ok || !attachPayload.ok) throw new Error(attachPayload.errors?.join(" ") ?? "Could not attach the media packet.");
      setMediaUpload(upload);
      toast("Media packet attached.", { description: hasRealStorage ? "Upload completed; rights evidence is queued for moderation." : "Local preview retained; storage completion waits for provider activation." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not prepare the media packet.";
      setErrors([message]);
      toast("Could not attach media.", { description: message });
    } finally {
      setMediaSubmitting(false);
    }
  };

  const detachMedia = async () => {
    if (!draftId || !mediaUpload || mediaSubmitting) return;
    setMediaSubmitting(true);
    try {
      const response = await fetch(`/api/broker/listings/${encodeURIComponent(draftId)}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: mediaUpload.id, action: "detach" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") ?? "Could not detach the media packet.");
      setMediaUpload(null);
      toast("Media packet detached.");
    } catch (error) {
      toast("Could not detach media.", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setMediaSubmitting(false);
    }
  };

  const postDraft = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrors([]);
    try {
      const response = await fetch("/api/broker/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") ?? "Could not create the draft.");
      setDraftId(payload.draft.id);
      setSubmitted(payload.draft.status === "IN_REVIEW");
      toast("Draft created.", { description: `Draft ${payload.draft.id} is ready for review.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the draft.";
      setErrors([message]);
      toast("Could not create the draft.", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const submitForReview = async () => {
    if (!draftId || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/broker/listings/${encodeURIComponent(draftId)}/submit`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" ") ?? "Could not submit for review.");
      setSubmitted(true);
      toast("Submitted for review.", { description: "A moderator will review the source trail." });
    } catch (error) {
      toast("Could not submit for review.", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const validate = () => {
    const next: string[] = [];
    if (draft.title.trim().length < 8) next.push("Title must be at least 8 characters.");
    if (!Number.isFinite(draft.priceInr) || draft.priceInr <= 0) next.push("Price must be a positive INR value.");
    if (!Number.isFinite(draft.areaSqft) || draft.areaSqft < 150) next.push("Area must be at least 150 sq ft.");
    if (draft.availability.trim().length < 3) next.push("Availability/status is required.");
    if (draft.description.trim().length < 30) next.push("Description must be at least 30 characters.");
    if (!draft.mediaRightsConfirmed) next.push("Media rights confirmation is required before review.");
    setErrors(next);
    return next.length === 0;
  };

  const onDraft = async () => {
    if (!validate()) return;
    await postDraft();
  };

  return (
    <div className="page-transition listing-dossier bg-paper pt-[78px] text-ink">
      <section className="listing-dossier-hero border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p className="kicker text-brick">Listing draft · moderation required</p><span className="stamp text-ink/45">SOURCE PACKET / 01 · AHMEDABAD</span></div>
          <h1 className="display mt-6 max-w-[760px] text-[clamp(40px,6vw,78px)]">Submit a home with the <em className="text-brick">source trail</em> attached.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">Capture the fields enforced by the listing contract, create a private draft, then submit the evidence packet for moderation.</p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/12 pt-4 stamp text-ink/50"><span>01 / capture</span><span>02 / verify</span><span>03 / review</span><span>04 / publish</span></div>
        </div>
      </section>

      <section className="listing-dossier-body container grid gap-8 py-14 lg:grid-cols-[1fr_360px] md:py-20">
        <div className="listing-packet border border-ink/12 bg-card p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/12 pb-5"><div><p className="kicker text-brick !text-[10px]">Draft fields</p><p className="mt-2 text-sm text-ink/55">Packet 01 · editorial facts and source context</p></div><span className="stamp text-ink/45">PRIVATE UNTIL REVIEW</span></div>
          <div className="mt-6 grid gap-5">
            <div className="listing-field-note flex items-center gap-2 border-l-2 border-brick/50 bg-sand/40 px-3 py-2 stamp text-[10px] text-ink/55"><FileCheck2 size={13} className="text-brick" /> Every value becomes part of the reviewable source packet.</div>
            <div className="border border-ink/12 bg-paper/45 p-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="kicker text-brick !text-[10px]">Packet readiness</p><p className="mt-1 text-sm text-ink/60">Complete the required facts before creating a draft.</p></div>
                <span className="stamp text-ink/55">{completion.complete} / {completion.total} complete</span>
              </div>
              <div className="mt-3 h-1.5 bg-ink/10" role="progressbar" aria-label="Required listing fields complete" aria-valuemin={0} aria-valuemax={completion.total} aria-valuenow={completion.complete}><div className="h-full bg-trust transition-[width] duration-300" style={{ width: `${(completion.complete / completion.total) * 100}%` }} /></div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink/55">{completion.checks.map((check) => <span key={check.label} className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${check.complete ? "bg-trust" : "bg-ink/25"}`} aria-hidden="true" />{check.label}</span>)}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" required>
                <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="A garden courtyard in Paldi" />
              </Field>
              <Field label="Price (INR)" required>
                <input type="number" value={draft.priceInr || ""} onChange={(e) => set("priceInr", Number(e.target.value))} className={inputCls} placeholder="18500000" />
              </Field>
              <Field label="BHK" required>
                <input type="number" value={draft.bhk} onChange={(e) => set("bhk", Number(e.target.value))} className={inputCls} min={1} />
              </Field>
              <Field label="Area (sq ft)" required>
                <input type="number" value={draft.areaSqft || ""} onChange={(e) => set("areaSqft", Number(e.target.value))} className={inputCls} placeholder="1482" />
              </Field>
              <Field label="Availability" required>
                <select value={draft.availability} onChange={(e) => set("availability", e.target.value)} className={inputCls}>
                  {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Property type" required>
                <select value={draft.propertyType} onChange={(e) => set("propertyType", e.target.value)} className={inputCls}>
                  {PROPERTY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="RERA number">
                <input value={draft.reraNumber ?? ""} onChange={(e) => set("reraNumber", e.target.value)} className={inputCls} placeholder="GJ/RERA/AHM/2026/04821" />
              </Field>
              <Field label="Locality" required>
                <select value={draft.localitySlug} onChange={(e) => set("localitySlug", e.target.value)} className={inputCls}>
                  {localities.map((locality) => <option key={locality.slug} value={locality.slug}>{locality.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description / source context" required>
              <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={4} className={inputCls} placeholder="Old trees, kota stone floors, and a courtyard that carries the whole house." />
            </Field>
            <label className="flex items-start gap-3 border border-brick/20 bg-brick/5 p-3 text-xs leading-5 text-ink/65">
              <input type="checkbox" checked={draft.mediaRightsConfirmed} onChange={(e) => set("mediaRightsConfirmed", e.target.checked)} className="mt-1 accent-[var(--brick)]" />
              <span>I confirm media rights for the images/plans and grant Architech publication rights.</span>
            </label>
            <section className="border border-ink/12 bg-paper/45 p-4" aria-labelledby="media-packet-title">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/12 pb-4">
                <div><p id="media-packet-title" className="kicker text-brick !text-[10px]">Media packet</p><p className="mt-1 text-sm text-ink/60">Preview locally, record rights evidence, then queue the file for moderation.</p></div>
                <span className="stamp text-ink/45">{mediaUpload ? mediaUpload.moderationStatus : "NOT ATTACHED"}</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="aspect-[4/3] overflow-hidden border border-ink/12 bg-sand/60">
                  {mediaPreviewUrl && mediaFile?.type.startsWith("video/") ? <video src={mediaPreviewUrl} controls muted playsInline className="h-full w-full object-cover" aria-label="Selected media preview" /> : mediaPreviewUrl ? <img src={mediaPreviewUrl} alt={`Local preview of ${mediaFile?.name ?? "selected media"}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-4 text-center stamp !text-[10px] text-ink/45">Choose an image or video to preview it here.</div>}
                </div>
                <div className="grid gap-4">
                  <label className="stamp !text-[10px] text-ink/60">Image or video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={(e) => onMediaFile(e.target.files?.[0] ?? null)} className="mt-1.5 block w-full border border-ink/20 bg-paper/35 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-night file:px-3 file:py-2 file:text-xs file:text-cream" /></label>
                  <label className="stamp !text-[10px] text-ink/60">Rights evidence<input value={mediaLicenseEvidence} onChange={(e) => setMediaLicenseEvidence(e.target.value)} className={inputCls} placeholder="Owner authorization or partner agreement reference" /></label>
                  <label className="flex items-start gap-3 text-xs leading-5 text-ink/65"><input type="checkbox" checked={mediaRightsConfirmed} onChange={(e) => setMediaRightsConfirmed(e.target.checked)} className="mt-1 accent-[var(--brick)]" /><span>I confirm I own or am authorised to publish this specific file.</span></label>
                  <button type="button" onClick={() => void prepareMediaUpload()} disabled={!draftId || !mediaFile || mediaSubmitting} className="btn-sweep touch-44 w-fit bg-night px-4 py-3 stamp !text-[11px] font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-45">{mediaSubmitting ? "Preparing…" : "Sign & attach media"}</button>
                </div>
              </div>
              {mediaUpload && <div className="mt-4 border-l-2 border-trust bg-trust/10 p-3 text-xs leading-5 text-ink/70"><div className="flex flex-wrap items-center justify-between gap-3"><span><strong className="font-semibold text-trust">Pending moderation.</strong> Rights evidence recorded; EXIF policy: {mediaUpload.exifPolicy}.</span><button type="button" onClick={() => void detachMedia()} className="stamp !text-[10px] font-semibold text-brick underline underline-offset-4">Detach</button></div><p className="mt-1 text-ink/55">Packet ID {mediaUpload.id} · {mediaUpload.licenseEvidence}</p></div>}
            </section>
          </div>

          {errors.length > 0 && (
            <div className="mt-6 border-l-4 border-brick bg-brick/5 p-4">
              {errors.map((error) => <p key={error} className="flex items-center gap-2 text-sm text-ink/75"><XCircle size={14} className="shrink-0 text-brick" /> {error}</p>)}
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-4">
            <button onClick={() => void onDraft()} disabled={submitting} className="btn-sweep touch-44 bg-night px-6 py-4 stamp !text-[12px] font-semibold text-cream disabled:cursor-wait disabled:opacity-60">
              <span className="flex items-center gap-2">{submitting ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />} Create draft</span>
            </button>
            {draftId && !submitted && (
              <button onClick={() => void submitForReview()} disabled={submitting} className="btn-sweep touch-44 bg-brick px-6 py-4 stamp !text-[12px] font-semibold text-cream disabled:cursor-wait disabled:opacity-60">
                <span className="flex items-center gap-2">{submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit for review</span>
              </button>
            )}
          </div>

          {submitted && (
            <div className="mt-6 flex items-center gap-2 border-l-4 border-trust bg-trust/10 p-4 text-sm text-ink/75">
              <CheckCircle2 size={16} className="shrink-0 text-trust" /> In review — a moderator will check the source trail.
            </div>
          )}
        </div>

        <aside className="listing-dossier-aside h-fit border border-ink/12 bg-sand/70 p-7">
          <div className="flex items-start justify-between"><ShieldCheck size={22} className="text-trust" /><span className="stamp text-ink/45">DOSSIER / 01</span></div>
          <h2 className="mt-7 font-display text-2xl font-medium tracking-[-0.02em]">Before review</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">A moderator should be able to understand what is claimed, where it belongs, and whether publication rights are clear.</p>
          <ul className="mt-5 space-y-3 border-t border-ink/12 pt-5 text-sm text-ink/65">
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Media rights confirmed</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Locality selected</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Price and area supplied</li>
            <li className="flex gap-2"><FileCheck2 size={15} className="mt-0.5 text-brick" /> Description has source context</li>
          </ul>
          <div className="mt-7 border-t border-ink/12 pt-4 stamp text-ink/45">LOCALITY · PRICE · MEDIA RIGHTS · RERA</div>
          <Link href="/admin/moderation/listings" className="mt-7 inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">View moderation queue <ArrowUpRight size={14} /></Link>
        </aside>
      </section>
    </div>
  );
}

const inputCls = "mt-1.5 w-full border border-ink/20 bg-paper/35 px-4 py-3 text-sm transition-colors duration-200 placeholder:text-ink/35 focus:border-brick focus:bg-card focus:outline-none";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="stamp !text-[10px] text-ink/60">{label}{required ? " ·" : ""}</span>
      {children}
    </label>
  );
}
