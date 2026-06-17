import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { apiGet, apiPatch } from '../../utils/api'
import type {
  DashboardNotificationSummary,
  DashboardNotificationCategory,
  DashboardOverviewResponse,
  DashboardReminder,
  OnboardingChecklist
} from '../../types/dashboard'
import { updateSettings } from '../../utils/auth'
import { useI18n } from '../../contexts/I18nContext'
import { dictionaries } from '../../i18n/translations'

const DISCOVER_ACTION_LABELS = new Set<string>([
  dictionaries.fr['dashboard.home.reminder.discover'],
  dictionaries.en['dashboard.home.reminder.discover']
])

export default function DashboardHome() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const dateLocale = numberLocale

  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null)
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiGet<DashboardOverviewResponse>('/dashboard/overview', {
      signal: controller.signal
    })
      .then(response => {
        setOverview(response)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        console.error('Unable to load dashboard overview', err)
        const message =
          err instanceof Error
            ? err.message
            : t('dashboard.home.loadError')
        setError(message)
        addToast({
          variant: 'error',
          title: t('dashboard.home.loadTitle'),
          message
        })
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [addToast, t])

  useEffect(() => {
    const checklist = overview?.onboardingChecklist
    if (!checklist) {
      setShowOnboardingModal(false)
      return
    }
    const hasPendingTasks = checklist.tasks.some(task => !task.completed)
    if (!checklist.dismissed && hasPendingTasks) {
      setShowOnboardingModal(true)
    } else if (!hasPendingTasks) {
      setShowOnboardingModal(false)
    }
  }, [overview])

  const stats = overview?.stats ?? []
  const reminders = useMemo(() => overview?.reminders ?? [], [overview?.reminders])
  const messages = overview?.messages ?? []
  const notificationSummary = overview?.notificationSummary ?? null
  const onboardingChecklist: OnboardingChecklist | null =
    overview?.onboardingChecklist ?? null
  const incompleteTasks = onboardingChecklist?.tasks.filter(task => !task.completed) ?? []

  const displayName = useMemo(() => {
    if (user?.firstName || user?.lastName) {
      return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    }
    if (user?.email) {
      return user.email
    }
    return t('dashboard.home.displayNameFallback')
  }, [t, user])

  const resolveReminderAction = (action: string) =>
    DISCOVER_ACTION_LABELS.has(action)
      ? t('dashboard.home.reminder.discover')
      : action

  const isDiscoverAction = (action: string) =>
    DISCOVER_ACTION_LABELS.has(action)

  const visibleReminders = useMemo(() => {
    return reminders.filter(reminder => !isDiscoverAction(reminder.action))
  }, [reminders])

  const handleReminderAction = (reminder: DashboardReminder) => {
    if (isDiscoverAction(reminder.action)) {
      return
    }

    navigate('/dashboard/listings')
  }

  const handleMarkNotification = async (notificationId: string) => {
    if (!overview?.notificationSummary || markingNotificationId === notificationId) {
      return
    }

    const notification = overview.notificationSummary.recent.find(item => item.id === notificationId)
    if (!notification || notification.isRead) {
      return
    }

    setMarkingNotificationId(notificationId)
    setOverview(prev => {
      if (!prev?.notificationSummary) {
        return prev
      }
      return {
        ...prev,
        notificationSummary: applyNotificationRead(prev.notificationSummary, notificationId)
      }
    })

    try {
      await apiPatch(`/notifications/${notificationId}/read`)
    } catch (err) {
      console.error('Unable to mark notification as read', err)
      addToast({
        variant: 'error',
        title: t('dashboard.home.notifications.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.home.notifications.errorMessage')
      })
      setOverview(prev => {
        if (!prev?.notificationSummary) {
          return prev
        }
        return {
          ...prev,
          notificationSummary: revertNotificationRead(prev.notificationSummary, notificationId)
        }
      })
    } finally {
      setMarkingNotificationId(null)
    }
  }

  const handleMarkAllNotifications = async () => {
    if (!overview?.notificationSummary || markingAllNotifications || !overview.notificationSummary.totalUnread) {
      return
    }

    setMarkingAllNotifications(true)

    setOverview(prev => {
      if (!prev?.notificationSummary) {
        return prev
      }
      return {
        ...prev,
        notificationSummary: applyNotificationReadAll(prev.notificationSummary)
      }
    })

    try {
      await apiPatch('/notifications/read-all')
    } catch (err) {
      console.error('Unable to mark all notifications as read', err)
      addToast({
        variant: 'error',
        title: t('dashboard.home.notifications.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.home.notifications.errorAllMessage')
      })
      apiGet<DashboardOverviewResponse>('/dashboard/overview')
        .then(setOverview)
        .catch(loadErr => {
          console.error('Unable to refresh overview after notification error', loadErr)
        })
    } finally {
      setMarkingAllNotifications(false)
    }
  }

  const handleDismissOnboarding = async () => {
    if (!overview?.onboardingChecklist) {
      setShowOnboardingModal(false)
      return
    }

    const previous = overview.onboardingChecklist
    setShowOnboardingModal(false)
    setOverview(prev => {
      if (!prev?.onboardingChecklist) {
        return prev
      }
      return {
        ...prev,
        onboardingChecklist: {
          ...prev.onboardingChecklist,
          dismissed: true
        }
      }
    })

    try {
      await updateSettings({ onboardingChecklistDismissed: true })
    } catch (err) {
      console.error('Unable to dismiss onboarding checklist', err)
      addToast({
        variant: 'error',
        title: t('dashboard.home.onboarding.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('dashboard.home.onboarding.errorMessage')
      })
      setOverview(prev => {
        if (!prev) {
          return prev
        }
        return {
          ...prev,
          onboardingChecklist: previous
        }
      })
    }
  }

  const renderNotificationBody = (summary: DashboardNotificationSummary) => {
    if (!summary.recent.length) {
      return (
        <p className="notification-center__empty">
          {t('dashboard.home.notifications.empty')}
        </p>
      )
    }

    return (
      <div className="notification-center__list">
        {summary.recent.map(notification => (
          <article
            key={notification.id}
            className={`notification-center__item${
              notification.isRead ? '' : ' notification-center__item--unread'
            }`}
          >
            <div className="notification-center__content">
              <div className="notification-center__meta">
                <span className="notification-center__category">
                  {resolveNotificationCategoryLabel(notification.category, t)}
                </span>
                <time className="notification-center__time">
                  {new Date(notification.created_at).toLocaleString(dateLocale)}
                </time>
              </div>
              <p className="notification-center__title">{notification.title}</p>
              {notification.body ? (
                <p className="notification-center__body">{notification.body}</p>
              ) : null}
            </div>
            <div className="notification-center__actions">
              {!notification.isRead ? (
                <Button
                  variant="ghost"
                  onClick={() => handleMarkNotification(notification.id)}
                  disabled={markingNotificationId === notification.id}
                >
                  {t('dashboard.home.notifications.markRead')}
                </Button>
              ) : (
                <span className="notification-center__status">{t('dashboard.home.notifications.read')}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.home.greeting', { name: displayName })}</h1>
            <p>{t('dashboard.home.subtitle')}</p>
          </div>
          <Button
            className="dashboard-header__primary-action"
            onClick={() => {
              navigate('/listings/new')
            }}
          >
            {t('dashboard.home.cta.publish')}
          </Button>
        </header>

        {isLoading ? (
          <p style={{ padding: '1.5rem 0', color: '#6c757d' }}>
            {t('dashboard.home.loading')}
          </p>
        ) : null}

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {!isLoading && stats.length ? (
          <section className="dashboard-stats">
            {stats.map(stat => (
              <div key={stat.label} className="dashboard-stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <span>{stat.trend}</span>
              </div>
            ))}
          </section>
        ) : null}

        {!isLoading && visibleReminders.length ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('dashboard.home.quickActions.title')}</h2>
              <Link to="/dashboard/listings" className="lbc-link">
                {t('dashboard.home.quickActions.manageListings')}
              </Link>
            </div>
            <div className="message-list">
              {visibleReminders.map(reminder => (
                <div key={reminder.title} className="message-item">
                  <span className="message-item__title">{reminder.title}</span>
                  <span className="message-item__snippet">{reminder.due}</span>
                  <Button
                    variant="outline"
                    onClick={() => handleReminderAction(reminder)}
                    disabled={isDiscoverAction(reminder.action)}
                  >
                    {resolveReminderAction(reminder.action)}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && messages.length ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('dashboard.home.messages.title')}</h2>
              <Link to="/dashboard/messages" className="lbc-link">
                {t('dashboard.home.messages.cta')}
              </Link>
            </div>
            <div className="message-list">
              {messages.map(message => (
                <div key={`${message.from}-${message.time}`} className="message-item">
                  <span className="message-item__title">{message.from}</span>
                  <span className="message-item__snippet">{message.excerpt}</span>
                  <span className="message-item__snippet">{message.time}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && notificationSummary ? (
          <section className="dashboard-section">
            <div className="dashboard-section__head">
              <h2>{t('dashboard.home.notifications.title')}</h2>
              <div className="dashboard-section__head-actions">
                <span className="badge badge--info">
                  {notificationSummary.totalUnread === 1
                    ? t('dashboard.home.notifications.unreadSingle', {
                        count: new Intl.NumberFormat(numberLocale).format(
                          notificationSummary.totalUnread
                        )
                      })
                    : t('dashboard.home.notifications.unreadMultiple', {
                        count: new Intl.NumberFormat(numberLocale).format(
                          notificationSummary.totalUnread
                        )
                      })}
                </span>
                <Button
                  variant="outline"
                  onClick={handleMarkAllNotifications}
                  disabled={
                    markingAllNotifications || !notificationSummary.totalUnread
                  }
                >
                  {t('dashboard.home.notifications.markAll')}
                </Button>
              </div>
            </div>
            <div className="notification-center">
              {notificationSummary.categories.length ? (
                <div className="notification-center__summary">
                  {notificationSummary.categories.map(category => (
                    <div key={category.category} className="notification-center__summary-item">
                      <span className="notification-center__summary-label">
                        {resolveNotificationCategoryLabel(category.category, t)}
                      </span>
                      <strong className="notification-center__summary-unread">
                        {new Intl.NumberFormat(numberLocale).format(category.unread)}
                      </strong>
                      <span className="notification-center__summary-total">
                        {t('dashboard.home.notifications.total', {
                          count: new Intl.NumberFormat(numberLocale).format(category.total)
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {renderNotificationBody(notificationSummary)}
            </div>
          </section>
        ) : null}

      </div>
      <Modal
        open={showOnboardingModal && Boolean(incompleteTasks.length)}
        title={t('dashboard.home.onboarding.title')}
        description={t('dashboard.home.onboarding.description')}
        onClose={handleDismissOnboarding}
        footer={
          <Button variant="ghost" onClick={handleDismissOnboarding}>
            {t('dashboard.home.onboarding.later')}
          </Button>
        }
      >
        <p style={{ marginBottom: '1rem' }}>
          {t('dashboard.home.onboarding.intro')}
        </p>
        <ul className="checklist">
          {onboardingChecklist?.tasks.map(task => (
            <li
              key={task.key}
              className={`checklist__item${task.completed ? ' checklist__item--completed' : ''}`}
            >
              <div>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
              </div>
              {task.completed ? (
                <span className="checklist__status">{t('dashboard.home.onboarding.completed')}</span>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowOnboardingModal(false)
                    navigate(task.actionUrl)
                  }}
                >
                  {t('dashboard.home.onboarding.start')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </DashboardLayout>
  )
}

function resolveNotificationCategoryLabel(
  category: DashboardNotificationCategory,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  switch (category) {
    case 'saved_search':
      return t('dashboard.home.notifications.categories.savedSearch')
    case 'moderation':
      return t('dashboard.home.notifications.categories.moderation')
    case 'system':
    default:
      return t('dashboard.home.notifications.categories.system')
  }
}

function applyNotificationRead(
  summary: DashboardNotificationSummary,
  notificationId: string
): DashboardNotificationSummary {
  const target = summary.recent.find(item => item.id === notificationId)
  if (!target || target.isRead) {
    return summary
  }

  const updatedCategories = summary.categories.map(category => {
    if (category.category !== target.category) {
      return category
    }

    return {
      ...category,
      unread: Math.max(0, category.unread - 1),
      latest:
        category.latest && category.latest.id === target.id
          ? { ...category.latest, isRead: true }
          : category.latest
    }
  })

  return {
    ...summary,
    totalUnread: Math.max(0, summary.totalUnread - 1),
    categories: updatedCategories,
    recent: summary.recent.map(item =>
      item.id === target.id ? { ...item, isRead: true } : item
    )
  }
}

function revertNotificationRead(
  summary: DashboardNotificationSummary,
  notificationId: string
): DashboardNotificationSummary {
  const target = summary.recent.find(item => item.id === notificationId)
  if (!target || !target.isRead) {
    return summary
  }

  const updatedCategories = summary.categories.map(category => {
    if (category.category !== target.category) {
      return category
    }

    return {
      ...category,
      unread: category.unread + 1,
      latest:
        category.latest && category.latest.id === target.id
          ? { ...category.latest, isRead: false }
          : category.latest
    }
  })

  return {
    ...summary,
    totalUnread: summary.totalUnread + 1,
    categories: updatedCategories,
    recent: summary.recent.map(item =>
      item.id === target.id ? { ...item, isRead: false } : item
    )
  }
}

function applyNotificationReadAll(
  summary: DashboardNotificationSummary
): DashboardNotificationSummary {
  if (!summary.totalUnread) {
    return summary
  }

  return {
    ...summary,
    totalUnread: 0,
    categories: summary.categories.map(category => ({
      ...category,
      unread: 0,
      latest: category.latest ? { ...category.latest, isRead: true } : category.latest
    })),
    recent: summary.recent.map(item => ({ ...item, isRead: true }))
  }
}
