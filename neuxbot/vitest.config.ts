import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["neuxbot/src/**/*.test.ts"],
    environment: "node",
  },
});
