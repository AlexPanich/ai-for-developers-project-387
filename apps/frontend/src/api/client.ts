import type { components } from './schema'

/** Код ошибки из контракта: `ErrorBody.error.code`. */
export type ErrorCode = components['schemas']['ErrorBody']['error']['code']

/**
 * Единственный способ, которым ошибки API доходят до экрана: вызывающий код
 * ловит исключение и показывает `error.message`, а `code` отличает
 * «слот занят» (409) от остальных нарушений (§8 SPEC.md).
 */
export class ApiError extends Error {
  readonly code: ErrorCode | null

  constructor(message: string, code: ErrorCode | null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * Пути относительные: в dev Vite проксирует `/api` на бекенд (см.
 * `vite.config.ts`), в проде фронт и API живут на одном origin.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError('Не удалось связаться с сервером', null)
  }

  const body = await response.text()
  const payload = parseJson(body)

  const envelope = readErrorEnvelope(payload)
  if (envelope) {
    throw new ApiError(envelope.message, envelope.code)
  }

  if (!response.ok) {
    throw new ApiError(`Сервер ответил ошибкой ${response.status}`, null)
  }

  if (payload === undefined && body !== '') {
    throw new ApiError('Сервер ответил вне формата API', null)
  }

  return payload as T
}

/** POST с JSON-телом: контент-тип и сериализация — забота обёртки. */
export function postJson<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/**
 * Текст для показа на экране: `error.message` из конверта ошибки API (§8) или
 * запасная фраза, если упала не обёртка клиента. Общая для всех страниц.
 */
export function messageFromError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Неизвестная ошибка'
}

function parseJson(body: string): unknown {
  if (body === '') {
    return undefined
  }
  try {
    return JSON.parse(body) as unknown
  } catch {
    return undefined
  }
}

function readErrorEnvelope(payload: unknown): { code: ErrorCode | null; message: string } | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return null
  }
  const { error } = payload as { error: unknown }
  if (typeof error !== 'object' || error === null || !('code' in error) || !('message' in error)) {
    return null
  }
  const { code, message } = error as { code: unknown; message: unknown }
  if (typeof message !== 'string') {
    return null
  }
  // Код — из контракта (см. `schema.ts`); постороннего кода сервер отдавать не должен.
  return { code: typeof code === 'string' ? (code as ErrorCode) : null, message }
}
