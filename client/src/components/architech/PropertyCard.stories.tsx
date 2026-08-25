import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PropertyCard from "./PropertyCard";
import { StorySurface } from "@/stories/StorySurface";
import { getListings } from "@/lib/repositories";

const meta = {
  title: "Architech/PropertyCard",
  component: PropertyCard,
  parameters: { layout: "centered" },
  args: { property: getListings()[0], index: 0 },
  argTypes: {
    property: { control: false },
  },
} satisfies Meta<typeof PropertyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <StorySurface><div className="w-[340px]"><PropertyCard {...args} /></div></StorySurface>,
};

export const ArchImageTreatment: Story = {
  args: { property: getListings()[0], index: 0, arch: true },
  render: (args) => <StorySurface><div className="w-[340px]"><PropertyCard {...args} /></div></StorySurface>,
};

export const HindiLabels: Story = {
  args: { property: getListings()[2], index: 2 },
  render: (args) => <StorySurface lang="hi"><div className="w-[340px]"><PropertyCard {...args} /></div></StorySurface>,
};

export const CardGrid: Story = {
  render: () => (
    <StorySurface>
      <div className="grid max-w-5xl gap-6 md:grid-cols-4">
        {getListings().map((property, index) => <PropertyCard key={property.id} property={property} index={index} arch={index === 0} />)}
      </div>
    </StorySurface>
  ),
};
