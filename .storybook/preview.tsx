import type { Preview } from "@storybook/nextjs-vite";
import "@/theme.css";

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
    controls: { expanded: true },
    a11y: { test: "todo" },
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "#f4eee2" },
        { name: "night", value: "#1b1612" },
        { name: "card", value: "#fffaf0" },
      ],
    },
  },
};

export default preview;
