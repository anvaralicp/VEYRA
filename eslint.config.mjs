
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default Next.js build output
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Generated Prisma contracts
    "src/prisma/**",
    "migrations/snapshots/**",

    // Local AI-agent tool directories
    ".agents/**",
    ".claude/**",
    ".cursor/**",
    ".devin/**",

    // Standalone migration and staging verification scripts
    "scripts/**",

    // Root-level temporary debugging artifacts
    "fix*.js",
    "test-*.js",
    "migrate.ts",
  ]),
]);

export default eslintConfig;
