import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createApp } from "../src/app"
import { removeTempDbs, tempDbPath } from "./support"

let baseUrl = ""
const app = createApp({ dbPath: tempDbPath() })

beforeAll(async () => {
  await app.listen(0)
  const url = app.server?.url
  if (!url) throw new Error("Server did not start")
  baseUrl = url.origin
})

afterAll(() => {
  app.stop()
  removeTempDbs()
})

describe("smoke", () => {
  test("server responds over HTTP", async () => {
    const response = await fetch(`${baseUrl}/api/event-types`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ eventTypes: [] })
  })

  test("unknown route returns 404", async () => {
    const response = await fetch(`${baseUrl}/definitely-missing`)

    expect(response.status).toBe(404)
  })
})
