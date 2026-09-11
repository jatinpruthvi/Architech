import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Footer from "./Footer";
import { StorySurface } from "@/stories/StorySurface";

const meta = {
  title: "Architech/Footer",
  component: Footer,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = {
  render: () => <StorySurface padded={false}><Footer /></StorySurface>,
};

export const Hindi: Story = {
  render: () => <StorySurface lang="hi" padded={false}><Footer /></StorySurface>,
};

export const DarkMode: Story = {
  render: () => <StorySurface theme="dark" padded={false}><Footer /></StorySurface>,
};
