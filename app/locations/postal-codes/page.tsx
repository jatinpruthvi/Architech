import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidPincode } from "@/lib/pincodes";

export const metadata: Metadata = { title: "Resolve an exact India PIN — Architech", robots: { index: false, follow: true } };

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  const normalized = code.trim();
  if (isValidPincode(normalized)) redirect(`/locations/postal-codes/${normalized}/`);

  return (
    <main className="min-h-[70vh] bg-paper pt-[78px] text-ink">
      <section className="container py-16 md:py-24">
        <nav className="flex flex-wrap items-center gap-2 stamp-sm" aria-label="Breadcrumb"><Link href="/" className="link-rail">Home</Link><span>/</span><Link href="/locations/" className="link-rail">India locations</Link><span>/</span><span>PIN lookup</span></nav>
        <p className="kicker mt-12 text-brick">Exact match only</p>
        <h1 className="font-display mt-5 text-4xl md:text-6xl">Enter a valid six-digit PIN</h1>
        <p className="mt-5 max-w-[620px] leading-7 ink-2">PINs start from 1–9 and contain exactly six digits. Architech does not guess a place from a partial sorting prefix.</p>
        <form action="/locations/postal-codes" method="get" className="mt-8 flex max-w-[560px] flex-col gap-3 sm:flex-row" role="search">
          <label htmlFor="pin-code" className="sr-only">Six-digit PIN code</label>
          <input id="pin-code" name="code" defaultValue={normalized} inputMode="numeric" pattern="[1-9][0-9]{5}" minLength={6} maxLength={6} required className="min-h-12 flex-1 border border-brick bg-paper px-4 outline-none focus:ring-2 focus:ring-brick/20" />
          <button type="submit" className="min-h-12 bg-ink px-6 stamp text-paper transition hover:bg-brick">Resolve PIN</button>
        </form>
      </section>
    </main>
  );
}
