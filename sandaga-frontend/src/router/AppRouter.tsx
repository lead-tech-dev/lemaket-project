import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from '../pages/Home/Home'
import ListingDetail from '../pages/Listings/ListingDetail'
import ListingCheckout from '../pages/Listings/ListingCheckout'
import NewListing from '../pages/Listings/NewListing'
import EditListing from '../pages/Listings/EditListing'
import Login from '../pages/Auth/Login'
import Register from '../pages/Auth/Register'
import ForgotPassword from '../pages/Auth/ForgotPassword'
import ResetPassword from '../pages/Auth/ResetPassword'
import LogoutPage from '../pages/Auth/Logout'
import DashboardHome from '../pages/Dashboard/DashboardHome'
import DashboardOverview from '../pages/Dashboard/DashboardOverview'
import PromotionsPage from '../pages/Dashboard/Promotions'
import MyListings from '../pages/Dashboard/MyListings'
import FollowedSellers from '../pages/Dashboard/FollowedSellers'
import Favorites from '../pages/Dashboard/Favorites'
import Alerts from '../pages/Dashboard/Alerts'
import Deliveries from '../pages/Dashboard/Deliveries'
import Orders from '../pages/Dashboard/Orders'
import Messages from '../pages/Dashboard/Messages'
import Conversation from '../pages/Dashboard/Conversation'
import Profile from '../pages/Dashboard/Profile'
import Settings from '../pages/Dashboard/Settings'
import Payments from '../pages/Dashboard/Payments'
import ProAccount from '../pages/Dashboard/ProAccount'
import Wallet from '../pages/Dashboard/Wallet'
import AdminHome from '../pages/Admin/AdminHome'
import ListingsModeration from '../pages/Admin/ListingsModeration'
import Users from '../pages/Admin/Users'
import CompanyVerifications from '../pages/Admin/CompanyVerifications'
import CourierVerifications from '../pages/Admin/CourierVerifications'
import Reports from '../pages/Admin/Reports'
import Categories from '../pages/Admin/Categories'
import Promotions from '../pages/Admin/Promotions'
import Logs from '../pages/Admin/Logs'
import MessageNotificationLogs from '../pages/Admin/MessageNotificationLogs'
import AdminSettings from '../pages/Admin/Settings'
import AddCategory from '../pages/Admin/AddCategory'
import CategoryFormBuilder from '../pages/Admin/CategoryFormBuilder'
import PlatformWallet from '../pages/Admin/PlatformWallet'
import ZikopayTransactions from '../pages/Admin/ZikopayTransactions'
import About from '../pages/Static/About'
import Contact from '../pages/Static/Contact'
import Terms from '../pages/Static/Terms'
import PrivacyPolicy from '../pages/Static/PrivacyPolicy'
import Faq from '../pages/Static/Faq'
import Error404 from '../pages/Static/Error404'
import Error500 from '../pages/Static/Error500'
import Maintenance from '../pages/Maintenance/Maintenance'
import SearchResults from '../pages/Search/SearchResults'
import StorefrontPage from '../pages/Storefront/Storefront'
import StorefrontsPage from '../pages/Storefront/Storefronts'
import PublicUserProfile from '../pages/Users/PublicProfile'
import PaymentReturn from '../pages/Payments/PaymentReturn'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { useFeatureFlagsContext } from '../contexts/FeatureFlagContext'
import type { FeatureFlagName } from '../config/featureFlags'
import { Skeleton } from '../components/ui/Skeleton'
import { RetryBanner } from '../components/ui/RetryBanner'
import { useI18n } from '../contexts/I18nContext'

type ProtectedRouteProps = {
  element: JSX.Element
  requirePro?: boolean
  requireAdmin?: boolean
  featureFlag?: FeatureFlagName
}

function ProtectedRoute({ element, requirePro, requireAdmin, featureFlag }: ProtectedRouteProps) {
  const { t } = useI18n()
  const { loading, error, isAuthenticated, isPro, isAdmin } = useAuth()
  const { isEnabled } = useFeatureFlagsContext()

  if (loading) {
    return (
      <div
        className="route-guard-loading"
        style={{
          padding: '3rem 1.5rem',
          display: 'grid',
          gap: '12px',
          justifyItems: 'center'
        }}
      >
        <Skeleton width="180px" height="24px" />
        <Skeleton width="240px" height="16px" />
      </div>
    )
  }

  if (error) {
    return (
      <RetryBanner
        title={t('auth.errorTitle')}
        message={error}
        accessory="⚠️"
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin && !requireAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  if (requirePro && !isPro) {
    return <Navigate to="/dashboard" replace />
  }

  if (featureFlag && !isEnabled(featureFlag)) {
    const fallbackPath = requireAdmin ? '/admin' : '/dashboard'
    return <Navigate to={fallbackPath} replace />
  }

  return element
}

export function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route
          path="/listing/:id/checkout"
          element={<ProtectedRoute element={<ListingCheckout />} />}
        />
        <Route
          path="/payment/return"
          element={<ProtectedRoute element={<PaymentReturn />} />}
        />
        <Route
          path="/listings/new"
          element={<ProtectedRoute element={<NewListing />} />}
        />
        <Route path="/listings/edit/:id" element={<EditListing />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/store/:slug" element={<StorefrontPage />} />
        <Route path="/stores" element={<StorefrontsPage />} />
        <Route path="/user/:id" element={<PublicUserProfile />} />
        <Route path="/u/:slug" element={<PublicUserProfile />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/logout" element={<LogoutPage />} />

        <Route path="/dashboard" element={<ProtectedRoute element={<DashboardHome />} />} />
        <Route
          path="/dashboard/overview"
          element={
            <ProtectedRoute
              element={<DashboardOverview />}
              requirePro
              featureFlag="proOverview"
            />
          }
        />
        <Route
          path="/dashboard/promotions"
          element={
            <ProtectedRoute
              element={<PromotionsPage />}
              requirePro
              featureFlag="proPromotions"
            />
          }
        />
        <Route
          path="/dashboard/listings"
          element={<ProtectedRoute element={<MyListings />} />}
        />
        <Route
          path="/dashboard/follows"
          element={<ProtectedRoute element={<FollowedSellers />} />}
        />
        <Route
          path="/dashboard/favorites"
          element={<ProtectedRoute element={<Favorites />} />}
        />
        <Route
          path="/dashboard/alerts"
          element={<ProtectedRoute element={<Alerts />} />}
        />
        <Route
          path="/dashboard/deliveries"
          element={<ProtectedRoute element={<Deliveries />} />}
        />
        <Route
          path="/dashboard/orders"
          element={<ProtectedRoute element={<Orders />} />}
        />
        <Route
          path="/dashboard/messages"
          element={
            <ProtectedRoute
              element={<Messages />}
              requirePro
              featureFlag="proMessaging"
            />
          }
        />
        <Route
          path="/dashboard/messages/:id"
          element={
            <ProtectedRoute
              element={<Conversation />}
              requirePro
              featureFlag="proMessaging"
            />
          }
        />
        <Route
          path="/dashboard/profile"
          element={<ProtectedRoute element={<Profile />} />}
        />
        <Route
          path="/dashboard/settings"
          element={<ProtectedRoute element={<Settings />} />}
        />
        <Route
          path="/dashboard/wallet"
          element={<ProtectedRoute element={<Wallet />} />}
        />
        <Route
          path="/dashboard/payments"
          element={
            <ProtectedRoute
              element={<Payments />}
              requirePro
              featureFlag="proPayments"
            />
          }
        />
        <Route
          path="/dashboard/pro"
          element={
            <ProtectedRoute
              element={<ProAccount />}
              requirePro
              featureFlag="proPortal"
            />
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute
              element={<AdminHome />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/listings"
          element={
            <ProtectedRoute
              element={<ListingsModeration />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute
              element={<Users />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/company-verifications"
          element={
            <ProtectedRoute
              element={<CompanyVerifications />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/courier-verifications"
          element={
            <ProtectedRoute
              element={<CourierVerifications />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/platform-wallet"
          element={
            <ProtectedRoute
              element={<PlatformWallet />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/zikopay-transactions"
          element={
            <ProtectedRoute
              element={<ZikopayTransactions />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute
              element={<Reports />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute
              element={<Categories />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/categories/new"
          element={
            <ProtectedRoute
              element={<AddCategory />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/categories/:id/form"
          element={
            <ProtectedRoute
              element={<CategoryFormBuilder />}
              requireAdmin
              featureFlag="adminConsole"
            />
          }
        />
        <Route
          path="/admin/promotions"
          element={
            <ProtectedRoute
              element={<Promotions />}
              requireAdmin
              featureFlag="adminPromotions"
            />
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute
              element={<Logs />}
              requireAdmin
              featureFlag="adminLogs"
            />
          }
        />
        <Route
          path="/admin/notification-logs"
          element={
            <ProtectedRoute
              element={<MessageNotificationLogs />}
              requireAdmin
              featureFlag="adminLogs"
            />
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute
              element={<AdminSettings />}
              requireAdmin
              featureFlag="adminSettings"
            />
          }
        />

        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/faq" element={<Faq />} />

        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </BrowserRouter>
  )
}
