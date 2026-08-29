import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", ".next", "node_modules", "client/src/components/ui/**", "*.config.*", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Design-system exceptions: decorative anchors handled case-by-case
      "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tooltip"], allowExpressionValues: true }],
      /* `role="list"` on a <ul> is NOT redundant here. Safari + VoiceOver drop a
         list's semantics (and its "N items" announcement) as soon as list-style is
         removed — which Tailwind's preflight does globally. The explicit role is the
         documented fix, and the design system depends on it: a filter row's item count
         is information, not decoration. lib/ui/design-token-discipline.test.ts asserts
         every <ul> carries it, so the two must stay in agreement. */
      "jsx-a11y/no-redundant-roles": ["error", { ul: ["list"], ol: ["list"], li: ["listitem"] }],
    },
  },
);
