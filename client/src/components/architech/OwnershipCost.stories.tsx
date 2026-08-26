import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OwnershipCost } from "./OwnershipCost";
import { StorySurface } from "@/stories/StorySurface";
import { getListings } from "@/lib/repositories";

const meta = {
  title: "Architech/OwnershipCost",
  component: OwnershipCost,
  parameters: { layout: "centered" },
  args: { property: getListings()[0] },
  argTypes: { property: { control: false } },
} satisfies Meta<typeof OwnershipCost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <StorySurface><div className="w-full max-w-[600px] p-6"><OwnershipCost {...args} /></div></StorySurface>,
};
