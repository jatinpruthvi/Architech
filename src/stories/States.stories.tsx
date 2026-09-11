import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { ArrowUpRight, Bookmark, SlidersHorizontal } from "lucide-react";
import { StorySurface } from "./StorySurface";

function StatesPanel({ lang = "en" as "en" | "hi" }) {
  const isHi = lang === "hi";
  return (
    <StorySurface lang={lang}>
      <div className="max-w-4xl space-y-10">
        <section className="border border-dashed border-ink/25 p-10 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-t-full bg-sand text-brick"><Bookmark size={24} /></span>
          <h2 className="display mt-6 text-[clamp(30px,4vw,52px)]">{isHi ? "अभी कुछ सहेजा नहीं" : "Nothing saved yet"}<span className="text-brick">.</span></h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/60">{isHi ? "आंशिक अनुवाद और empty states का उदाहरण।" : "Empty states keep the user oriented and give one clear next action."}</p>
          <Link href="/search" className="btn-sweep motion-press mt-8 inline-flex items-center gap-2 bg-brick px-7 py-4 stamp !text-[12px] font-semibold text-cream">{isHi ? "घर खोजें" : "Find a home"} <ArrowUpRight size={15} /></Link>
        </section>

        <section className="border border-ink/12 bg-card p-7">
          <p className="kicker text-brick">{isHi ? "फ़िल्टर चिप्स" : "Filter chips"}</p>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={isHi ? "फ़िल्टर" : "Filters"}>
            {[isHi ? "2 BHK" : "2 BHK", isHi ? "₹1.5 करोड़ से कम" : "Under ₹1.5 Cr", isHi ? "RERA सत्यापित" : "RERA verified"].map((label, index) => (
              <button key={label} aria-pressed={index === 1} className={`touch-44 px-4 py-2.5 stamp !text-[11px] font-semibold ${index === 1 ? "bg-brick text-cream" : "border border-ink/20 text-ink/70"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 stamp !text-[10px] text-ink/60"><SlidersHorizontal size={12} /> {isHi ? "Storybook में Hindi state preview." : "Storybook previews interaction states before backend data lands."}</p>
        </section>
      </div>
    </StorySurface>
  );
}

const meta = {
  title: "Architech/States",
  component: StatesPanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StatesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnglishStates: Story = { args: { lang: "en" } };
export const HindiStates: Story = { args: { lang: "hi" } };
