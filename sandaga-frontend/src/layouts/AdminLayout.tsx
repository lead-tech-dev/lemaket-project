import type { PropsWithChildren } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { AdminSidebar } from '../components/AdminSidebar'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '../components/error/ErrorBoundary'

export default function AdminLayout({ children }: PropsWithChildren){
  return (
    <div className="layout layout--admin">
      <Header />
      <ErrorBoundary>
        <main className="container admin-shell">
          <AdminSidebar />
          <section className="admin-shell__content">{children ?? <Outlet />}</section>
        </main>
      </ErrorBoundary>
      <Footer />
    </div>
  )
}
