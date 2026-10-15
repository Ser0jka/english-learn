import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT || 5180);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `test-results/${process.env.E2E_PRODUCTION === "1" ? "production" : "development"}`,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `test-results/${process.env.E2E_PRODUCTION === "1" ? "production" : "development"}/results.json`,
      },
    ],
  ],
  fullyParallel: true,
  retries: 0,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: process.env.E2E_PRODUCTION === "1" ? "npm start" : "npm run dev",
    env: { PORT: String(port), LEXI_API_KEY: "", LEXI_IMAGE_API_KEY: "" },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
            (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
