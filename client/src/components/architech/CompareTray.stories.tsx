import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PropertyCard from "./PropertyCard";
import { StorySurface } from "@/stories/StorySurface";
import { getListings } from "@/lib/repositories";

const CompareFlow = () => (
  <StorySurface>
    <div className="max-w-4xl space-y-5 pb-28">
      <div>
        <p className="kicker text-brick">Compare interaction</p>
        <h1 className="display mt-3 text-[clamp(30px,4vw,48px)]">Pick two homes to reveal the compare tray.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink/60">Use the compare icon on each card. The floating tray and drawer are provided by the shared provider stack.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {getListings().slice(0, 3).map((property, index) => <PropertyCard key={property.id} property={property} index={index} />)}
      </div>
    </div>
  </StorySurface>
);

const meta = {
  title: "Architech/CompareTray",
  component: CompareFlow,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CompareFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveFlow: Story = {};
