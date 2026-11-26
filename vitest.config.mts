import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Pin the app time zone so date tests don't depend on the machine or CI runner.
    env: { APP_TIME_ZONE: "Asia/Singapore" },
  },
});
