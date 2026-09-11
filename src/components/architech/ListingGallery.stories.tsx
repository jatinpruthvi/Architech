import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListingGallery } from "./ListingGallery";
import { StorySurface } from "@/stories/StorySurface";
import { getListings } from "@/lib/repositories";

const meta = {
  title: "Architech/ListingGallery",
  component: ListingGallery,
  parameters: { layout: "fullscreen" },
  args: { property: getListings()[0] },
  argTypes: { property: { control: false } },
} satisfies Meta<typeof ListingGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <StorySurface><div className="mx-auto w-full max-w-[900px] p-6"><ListingGallery {...args} /></div></StorySurface>,
};
