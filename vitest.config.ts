import { defineConfig } from "vitest/config";

const floor = { lines: 75, branches: 75, functions: 75, statements: 75 };

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "apps/web/src/main.tsx"],
      reporter: [["text", { skipFull: false }], "text-summary"],
      thresholds: {
        ...floor,
        "packages/model/src/**": floor,
        "packages/rules/src/**": floor,
        "packages/cases/src/**": floor,
        "apps/server/src/**": floor,
        "apps/web/src/**": floor,
      },
    },
  },
});
