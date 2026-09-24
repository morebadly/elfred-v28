import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical non-V28 prototypes remain in the delivery package for
    // reference, but the active product route is app/v28.
    "app/agent-home.tsx",
    "app/onboarding.tsx",
    "app/page.tsx",
    "app/product-state.tsx",
    "app/v27-7-data.ts",
    "app/v27-7-state.ts",
    "app/device-frame.tsx",
    "worker-configuration.d.ts",
  ]),
  {
    files: ["app/v28/**/*.{ts,tsx}", "app/v27-7-app.tsx"],
    rules: {
      // V28 restores persisted/demo state after mount. Keep this established
      // behavior during structural modularization.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
