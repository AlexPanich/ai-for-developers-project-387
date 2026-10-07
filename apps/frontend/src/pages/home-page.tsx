import { Link } from 'react-router'
import { SiteHeader } from '@/components/site-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Факты §3–§5: утверждения о модели переписаны под спецификацию (§6),
// дословные надписи (кнопки, ссылки, шаги) взяты как есть.
const facts = [
  'Слоты с шагом 30 минут: с 09:00 до 17:30 по Москве.',
  'На одно время — не больше одного бронирования.',
  'Бронирование в три шага: Календарь → Информация → Подтверждение записи.',
]

const description =
  'Гость выбирает тип события и бронирует слот: рабочий день 09:00–18:00 по Москве, выбрать можно на 14 дней вперёд.'

export function HomePage() {
  return (
    <div className="min-h-svh bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,#7eabff_0%,rgb(158_190_255/0.55)_36%,transparent_68%),linear-gradient(145deg,#e8f0ff_0%,#f7f8fb_48%,#ffe8d6_100%)] text-foreground">
      <SiteHeader />

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-xl">
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Календарь звонков
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">{description}</p>
          <Link
            to="/book"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-8 h-11 px-5 text-base')}
          >
            Забронировать
          </Link>
        </section>

        <Card className="bg-card/95 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Как это работает</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-muted-foreground">
              {facts.map((fact) => (
                <li key={fact} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
