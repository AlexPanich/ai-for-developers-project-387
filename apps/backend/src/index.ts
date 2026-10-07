import { join } from "node:path"
import { createHostApp } from "./host"

/** Дист фронта: `apps/frontend/dist` (см. `bun run build`); в контейнере уже собран. */
const assetsDir = join(import.meta.dir, "..", "..", "frontend", "dist")

const app = createHostApp({ assetsDir, dbPath: process.env.DB_PATH })

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000

app.listen(port)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
