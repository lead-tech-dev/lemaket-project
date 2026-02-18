import type { PropsWithChildren } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { Outlet } from 'react-router-dom'
import { ErrorBoundary } from '../components/error/ErrorBoundary'


export default function MainLayout({ children }: PropsWithChildren){
  return (
    <div className="layout layout--main">
        <Header />
        <ErrorBoundary>
          <main className="container">{children ?? <Outlet />}</main>
        </ErrorBoundary>
        <Footer />
      </div>
  )
}
