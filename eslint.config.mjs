import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Ignore generated and third-party files
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
    "public/swe-worker-*.js",
    "electron/**",
  ]),

  // Project-wide rule overrides
  {
    rules: {
      // ── TypeScript ──────────────────────────────────────────────────────
      // Allow `any` — large existing codebase, will type properly over time
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused vars (warn instead of error)
      "@typescript-eslint/no-unused-vars": "warn",
      // Allow require() in config/electron files
      "@typescript-eslint/no-require-imports": "off",

      // ── React Hooks ─────────────────────────────────────────────────────
      // setState in effects is acceptable for initialisation patterns
      "react-hooks/set-state-in-effect": "off",
      // Impure function calls in render (e.g. Date.now in useState initialiser)
      "react-hooks/purity": "off",
      // Static components defined inside render — warn only
      "react-hooks/static-components": "warn",
      // Missing deps — warn instead of error
      "react-hooks/exhaustive-deps": "warn",
      // TDZ / immutability — warn only
      "react-hooks/immutability": "warn",

      // ── Next.js ─────────────────────────────────────────────────────────
      // Allow <img> tags — switching to next/image is a gradual migration
      "@next/next/no-img-element": "warn",
      // Font display / page custom font — these are layout-level fonts, warn only
      "@next/next/google-font-display": "warn",
      "@next/next/no-page-custom-font": "warn",

      // ── React ───────────────────────────────────────────────────────────
      // Unescaped entities — warn only
      "react/no-unescaped-entities": "warn",

      // ── General ─────────────────────────────────────────────────────────
      "prefer-const": "warn",
      "no-unused-expressions": "warn",
    },
  },
]);

export default eslintConfig;
