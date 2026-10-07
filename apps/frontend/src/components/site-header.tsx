import { Calendar } from 'lucide-react'
import { Link } from 'react-router'

/** Шапка сайта: логотип и навигация между страницами (SPEC §6). */
export function SiteHeader() {
  return (
    <header className="border-b border-border/70 bg-background/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Calendar aria-hidden="true" className="size-5 text-primary" />
          Календарь звонков
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/book" className="hover:text-foreground">
            Забронировать
          </Link>
          <Link to="/events" className="hover:text-foreground">
            Предстоящие встречи
          </Link>
        </nav>
      </div>
    </header>
  )
}
