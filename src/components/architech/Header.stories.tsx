import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Header from "./Header";
import { StorySurface } from "@/stories/StorySurface";

const meta = {
  title: "Architech/Header",
  component: Header,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  render: () => <StorySurface padded={false}><div className="min-h-[220px] pt-[90px]"><Header /></div></StorySurface>,
};

export const DarkHeroState: Story = {
  render: () => <StorySurface theme="dark" padded={false}><div className="min-h-[260px] bg-night pt-[90px]"><Header /></div></StorySurface>,
};

export const Hindi: Story = {
  render: () => <StorySurface lang="hi" padded={false}><div className="min-h-[220px] pt-[90px]"><Header /></div></StorySurface>,
};
