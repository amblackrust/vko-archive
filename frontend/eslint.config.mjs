import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  // public/vendor — сторонний минифицированный pdf.js; .next-e2e — сборка E2E-стенда.
  { ignores: [".next/**", ".next-e2e/**", ".next-demo/**", "node_modules/**", "next-env.d.ts", "public/vendor/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
