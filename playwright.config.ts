import { defineConfig } from "@playwright/test"

/** Порт E2E-сервера: SPA и API на одном origin (см. `apps/backend/src/host.ts`). */
const PORT = 4180
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  // Один сквозной тест с общей БД: параллелизм только помешал бы
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    // Сборка фронта и изолированная БД на каждый прогон: dev-`data.db` не трогаем
    command:
      "rm -rf .playwright && mkdir -p .playwright" +
      " && bun run --filter frontend build" +
      ` && DB_PATH=.playwright/data.db PORT=${PORT} bun apps/backend/src/index.ts`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
