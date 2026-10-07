import { type ChangeEvent, type FormEvent, useState } from 'react'
import { messageFromError } from '@/api/client'
import { createEventType } from '@/api/sdk'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Пароль Владельца (SPEC §7): одна константа и для guard, и для заголовка API. */
export const OWNER_PASSWORD = 'secret'

/** Поля формы создания типа события (§7); длительность приходит строкой из input. */
interface FormState {
  name: string
  description: string
  durationMinutes: string
}

const INITIAL_FORM: FormState = { name: '', description: '', durationMinutes: '45' }

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring'
const labelClass = 'text-sm font-medium'

export function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [guardError, setGuardError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== OWNER_PASSWORD) {
      setGuardError('Неверный пароль')
      return
    }
    setGuardError(null)
    setUnlocked(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setCreated(false)
    try {
      await createEventType(
        {
          name: form.name,
          description: form.description,
          durationMinutes: Number(form.durationMinutes),
        },
        OWNER_PASSWORD,
      )
      // Форма готова к следующему созданию (AC #19)
      setCreated(true)
      setForm((current) => ({ ...current, name: '', description: '' }))
    } catch (error) {
      setErrorMessage(messageFromError(error))
    }
  }

  return (
    <main
      className={
        unlocked
          ? 'flex min-h-svh items-start justify-center bg-background px-6 py-12'
          : 'flex min-h-svh items-center justify-center bg-background px-6'
      }
    >
      {/* Guard остаётся в DOM после входа (класс hidden): удаление password-поля в одном
          React-коммите с монтированием формы приводит к неверной классификации поля
          «Название» как парольного — secure input и блокировка раскладки macOS (#33) */}
      <Card className={unlocked ? 'hidden w-full max-w-sm' : 'w-full max-w-sm'}>
        <CardHeader>
          <CardTitle className="text-xl">Создание типа события</CardTitle>
          <CardDescription>Введите пароль владельца</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <label htmlFor="owner-password" className={labelClass}>
              Пароль
            </label>
            <input
              id="owner-password"
              type="password"
              className={fieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {guardError ? (
              <p role="alert" className="text-sm text-destructive">
                {guardError}
              </p>
            ) : null}
            <Button type="submit">Войти</Button>
          </form>
        </CardContent>
      </Card>
      {unlocked ? (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl">Создание типа события</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label htmlFor="event-name" className={labelClass}>
                Название
              </label>
              {/* Автозаполнение отключаем: Chrome классифицирует поле по токену `name`
                в id и на https включает secure input — раскладка macOS не переключается (#33) */}
              <input
                id="event-name"
                autoComplete="off"
                className={fieldClass}
                value={form.name}
                onChange={updateField('name')}
              />

              <label htmlFor="event-description" className={labelClass}>
                Описание
              </label>
              <textarea
                id="event-description"
                className={`${fieldClass} min-h-20`}
                value={form.description}
                onChange={updateField('description')}
              />

              <label htmlFor="event-duration" className={labelClass}>
                Длительность в минутах
              </label>
              <input
                id="event-duration"
                type="number"
                min={1}
                max={540}
                className={fieldClass}
                value={form.durationMinutes}
                onChange={updateField('durationMinutes')}
              />

              {errorMessage ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}
              {created ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Тип события создан
                </p>
              ) : null}

              <Button type="submit" className="self-start">
                Создать
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
