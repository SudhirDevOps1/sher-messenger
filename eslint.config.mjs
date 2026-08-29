import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    rules: {
      /**
       * The messenger intentionally uses a subscribable mutable encrypted-vault class
       * instead of cloning key material through React state. Mutating that external
       * store and hydrating cache-backed state in effects are explicit boundaries,
       * not accidental prop mutation. Hooks ordering/rules-of-hooks remain enforced.
       */
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      /** Internal anchors preserve normal open-in-new-tab behavior throughout docs. */
      "@next/next/no-html-link-for-pages": "off",
      /** Product copy deliberately uses natural quotes in long technical prose. */
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".vercel/**",
    ".netlify/**",
    ".wrangler/**",
    "out/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);
