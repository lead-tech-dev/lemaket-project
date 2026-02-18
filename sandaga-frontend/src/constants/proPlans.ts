export type PlanActionMode = 'trial' | 'subscribe'

export type ProPlanOption = {
  id: string
  name: string
  description: string
  priceLabel: string
  cta: string
  mode: PlanActionMode
  buttonVariant?: 'primary' | 'ghost' | 'accent' | 'outline' | 'danger'
  loadingLabel: string
}

type Translate = (key: string, values?: Record<string, string | number>) => string

export type ProPlanConfig = Pick<ProPlanOption, 'id' | 'mode' | 'buttonVariant'>

export const PRO_PLAN_CONFIGS: ProPlanConfig[] = [
  { id: 'starter', mode: 'subscribe', buttonVariant: 'outline' },
  { id: 'business', mode: 'subscribe', buttonVariant: 'accent' },
  { id: 'premium', mode: 'subscribe', buttonVariant: 'primary' }
]

export const buildProPlanOptions = (t: Translate): ProPlanOption[] =>
  PRO_PLAN_CONFIGS.map(plan => ({
    ...plan,
    name: t(`proAccount.plans.${plan.id}.name`),
    description: t(`proAccount.plans.${plan.id}.description`),
    priceLabel: t(`proAccount.plans.${plan.id}.price`),
    cta: t(`proAccount.plans.${plan.id}.cta`),
    loadingLabel: t(`proAccount.plans.${plan.id}.loading`)
  }))

export const formatProSubscriptionDate = (
  value: string | null | undefined,
  locale: string = 'fr-FR'
) => {
  if (!value) {
    return null
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
      new Date(value)
    )
  } catch {
    return null
  }
}

export const buildProPlanProcessingKey = (planId: string, mode: PlanActionMode) =>
  `${planId}:${mode}`
