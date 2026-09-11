import type { StorybookConfig } from "@storybook/nextjs-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public"],
  typescript: { reactDocgen: "react-docgen-typescript" },
  core: { allowedHosts: ["localhost", "127.0.0.1", ".e2b.app"] },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(dirname, "../src"),
      "@shared": path.resolve(dirname, "../src/shared"),
    };
    return config;
  },
};

export default config;
