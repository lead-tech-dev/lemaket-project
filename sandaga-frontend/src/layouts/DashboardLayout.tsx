import type { PropsWithChildren } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '../components/error/ErrorBoundary'


export default function DashboardLayout({ children }: PropsWithChildren){
  return (
    <div className="layout layout--dashboard">
        <Header />
        <ErrorBoundary>
          <div className="container dashboard-shell">
            <Sidebar />
            <section className="dashboard-shell__content">{children ?? <Outlet />}</section>
          </div>
        </ErrorBoundary>
        <Footer />
      </div>
  )
}
