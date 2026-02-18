import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { apiPost } from '../../utils/api'
import type { CheckoutResult } from '../../types/payment'
import {
  PRO_PLAN_CONFIGS,
  buildProPlanProcessingKey,
  formatProSubscriptionDate,
  type PlanActionMode
} from '../../constants/proPlans'
import { useI18n } from '../../contexts/I18nContext'

export default function ProAccount(){
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const { locale, t } = useI18n()
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'
  const benefits = useMemo(
    () => [
      {
        title: t('proAccount.benefits.storefront.title'),
        description: t('proAccount.benefits.storefront.description')
      },
      {
        title: t('proAccount.benefits.marketing.title'),
        description: t('proAccount.benefits.marketing.description')
      },
      {
        title: t('proAccount.benefits.support.title'),
        description: t('proAccount.benefits.support.description')
      },
      {
        title: t('proAccount.benefits.payments.title'),
        description: t('proAccount.benefits.payments.description')
      }
    ],
    [t]
  )

  const planCopy = (planId: string) => {
    switch (planId) {
      case 'business':
        return {
          name: t('proAccount.plans.business.name'),
          description: t('proAccount.plans.business.description'),
          price: t('proAccount.plans.business.price'),
          cta: t('proAccount.plans.business.cta'),
          loading: t('proAccount.plans.business.loading')
        }
      case 'premium':
        return {
          name: t('proAccount.plans.premium.name'),
          description: t('proAccount.plans.premium.description'),
          price: t('proAccount.plans.premium.price'),
          cta: t('proAccount.plans.premium.cta'),
          loading: t('proAccount.plans.premium.loading')
        }
      case 'starter':
      default:
        return {
          name: t('proAccount.plans.starter.name'),
          description: t('proAccount.plans.starter.description'),
          price: t('proAccount.plans.starter.price'),
          cta: t('proAccount.plans.starter.cta'),
          loading: t('proAccount.plans.starter.loading')
        }
    }
  }

  const handlePlanAction = async (planId: string, mode: PlanActionMode) => {
    setProcessingKey(buildProPlanProcessingKey(planId, mode))
    try {
      const result = await apiPost<CheckoutResult>('/payments/pro-plans', {
        planId,
        mode
      })

      if (result.redirectUrl) {
        addToast({
          variant: 'info',
          title: t('proAccount.toast.redirectTitle'),
          message: t('proAccount.toast.redirectMessage')
        })
        window.location.assign(result.redirectUrl)
        return
      }

      const formattedDate = formatProSubscriptionDate(result.nextRenewalAt ?? null, dateLocale)
      if (mode === 'trial') {
        addToast({
          variant: 'success',
          title: t('proAccount.toast.trialTitle'),
          message: formattedDate
            ? t('proAccount.toast.trialMessageWithDate', { date: formattedDate })
            : t('proAccount.toast.trialMessageNoDate')
        })
      } else {
        addToast({
          variant: 'success',
          title: t('proAccount.toast.subscribeTitle'),
          message: formattedDate
            ? t('proAccount.toast.subscribeMessageWithDate', { date: formattedDate })
            : t('proAccount.toast.subscribeMessageNoDate')
        })
        navigate('/dashboard/payments')
      }
    } catch (err) {
      console.error('Unable to request PRO plan', err)
      addToast({
        variant: 'error',
        title: t('proAccount.toast.errorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('proAccount.toast.errorMessage')
      })
    } finally {
      setProcessingKey(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('proAccount.title')}</h1>
            <p>{t('proAccount.subtitle')}</p>
          </div>
          <Button variant="accent">{t('proAccount.cta')}</Button>
        </header>

        <section className="dashboard-section">
          <h2>{t('proAccount.benefits.title')}</h2>
          <div className="pro-benefits__grid">
            {benefits.map(benefit => (
              <div key={benefit.title} className="pro-benefit">
                <strong>{benefit.title}</strong>
                <span>{benefit.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section__head">
            <h2>{t('proAccount.pricing.title')}</h2>
            <span>{t('proAccount.pricing.subtitle')}</span>
          </div>
          <div className="message-list">
            {PRO_PLAN_CONFIGS.map(plan => {
              const currentKey = buildProPlanProcessingKey(plan.id, plan.mode)
              const isProcessing = processingKey === currentKey
              const copy = planCopy(plan.id)
              return (
                <div key={plan.id} className="message-item">
                  <div>
                    <span className="message-item__title">{copy.name}</span>
                    <span className="message-item__snippet">{copy.description}</span>
                  </div>
                  <span className="message-item__snippet">{copy.price}</span>
                  <Button
                    variant={plan.buttonVariant ?? 'primary'}
                    onClick={() => handlePlanAction(plan.id, plan.mode)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? copy.loading : copy.cta}
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
