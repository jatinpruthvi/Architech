import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LocalityIntel from "./LocalityIntel";
import { StorySurface } from "@/stories/StorySurface";
import { localityIntel } from "@/lib/realestate/locality-intel";
import { getLocalityBySlug } from "@/lib/repositories";
import { getListingsByLocality } from "@/lib/repositories";

const meta = {
  title: "Architech/LocalityIntel",
  component: LocalityIntel,
  parameters: { layout: "fullscreen" },
  args: {
    intel: localityIntel("paldi"),
    locality: getLocalityBySlug("paldi")!,
    newProjects: getListingsByLocality("paldi"),
  },
  argTypes: {
    intel: { control: false },
    locality: { control: false },
    newProjects: { control: false },
  },
} satisfies Meta<typeof LocalityIntel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <StorySurface>
      <div className="max-w-6xl">
        <LocalityIntel {...args} />
      </div>
    </StorySurface>
  ),
};

export const HindiLabels: Story = {
  args: {
    intel: localityIntel("paldi"),
    locality: getLocalityBySlug("paldi")!,
    newProjects: getListingsByLocality("paldi"),
  },
  render: (args) => (
    <StorySurface lang="hi">
      <div className="max-w-6xl">
        <LocalityIntel {...args} />
      </div>
    </StorySurface>
  ),
};
