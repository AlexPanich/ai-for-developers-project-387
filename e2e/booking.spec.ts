import { expect, test } from "@playwright/test"

/** Пароль Владельца (SPEC §7): та же константа, что в админке и API. */
const OWNER_PASSWORD = "secret"

/**
 * Сквозной сценарий приёмки (issue #30): владелец создаёт тип, гость проходит
 * мастер бронирования целиком — тип → календарь → свободный слот → «Информация»
 * → «Подтверждение записи», — а владелец видит встречу в своём списке (§6, §7).
 */
test("гость бронирует свободный слот, владелец видит встречу в списке", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/event-types", {
    headers: { "X-Admin-Password": OWNER_PASSWORD },
    data: { name: "Созвон", description: "Разговор по делу", durationMinutes: 45 },
  })
  expect(created.status()).toBe(201)

  // Лендинг → список типов → мастер записи (§6)
  await page.goto("/")
  await page.getByRole("link", { name: "Забронировать" }).first().click()
  await page.getByRole("link", { name: /Созвон/ }).click()

  // Шаг «Календарь»: первая дата окна со свободными слотами, бейдж «N св.» (§5)
  const date = page
    .locator("button")
    .filter({ has: page.locator("span", { hasText: /^[1-9]\d* св\.$/ }) })
    .first()
  await date.click()
  const dateLabel = await date.getAttribute("aria-label")
  expect(dateLabel).toMatch(/^\d+ \S+ \d{4}$/)

  // Свободный слот → «Продолжить» открывает шаг «Информация» (§5)
  const slot = page.getByRole("button", { name: "Свободно" }).first()
  const startTime = (await slot.textContent())?.match(/^(\d{2}:\d{2})/)?.[1]
  expect(startTime).toBeTruthy()
  await slot.click()
  await page.getByRole("button", { name: "Продолжить" }).click()

  // Шаг «Информация»: имя и email гостя → «Подтверждение записи» (§5)
  await page.getByLabel("Имя").fill("Иван Петров")
  await page.getByLabel("Email").fill("ivan@example.com")
  await page.getByRole("button", { name: "Подтвердить запись" }).click()

  // Успех виден гостю дословно (§5)
  await expect(page.getByText("Бронь подтверждена. До встречи!")).toBeVisible()

  // Владелец открывает свой список: встреча всех типов — тип и время (§6, §7)
  await page.goto("/events")
  await expect(page.getByText("Созвон")).toBeVisible()
  await expect(page.getByText(`${dateLabel} · ${startTime}`)).toBeVisible()
})
