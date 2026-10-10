import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next@16 exports native flat-config arrays (no FlatCompat needed).
const config = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "next-env.d.ts", "src/lib/api-types.ts", "coverage/**", "node_modules/**"],
  },
];

export default config;
