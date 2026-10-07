import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminPage } from '@/pages/admin-page'
import { BookPage } from '@/pages/book-page'
import { BookingPage } from '@/pages/booking-page'
import { EventsPage } from '@/pages/events-page'
import { HomePage } from '@/pages/home-page'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/book/:id" element={<BookingPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
