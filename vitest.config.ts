import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/types.ts", "src/cli.ts", "src/serve/**"],
    },
  },
});
