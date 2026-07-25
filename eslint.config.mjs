import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Vinext admin navigation intentionally performs full document requests so
      // the ChatGPT authentication boundary is re-evaluated on every route.
      "@next/next/no-html-link-for-pages": "off",
      // Product and editorial images are user-managed R2/external URLs. They
      // cannot safely use Next's build-time image host allowlist.
      "@next/next/no-img-element": "off",
      // D1-backed client screens load and refresh data after mount. The React 19
      // rule flags these awaited API loaders even though updates happen after I/O.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
