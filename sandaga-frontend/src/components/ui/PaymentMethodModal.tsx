import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from './Modal'
import { Button } from './Button'
import { FormField } from './FormField'
import { Input } from './Input'
import { Select } from './Select'
import type { PaymentMethod } from '../../types/payment'
import { useI18n } from '../../contexts/I18nContext'

export type PaymentMethodForm = {
  provider: 'mtn' | 'orange'
  externalId: string
  holderName: string
  label?: string
  isDefault?: boolean | 'on'
}

function normalizeCameroonMobileNumber(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('237') ? digits.slice(3) : digits
  if (!/^6\d{8}$/.test(local)) {
    return null
  }
  return `+237${local}`
}

function isProviderPhonePrefixMatch(provider: 'mtn' | 'orange', normalizedPhone: string): boolean {
  const local = normalizedPhone.replace('+237', '')
  if (provider === 'mtn') {
    return /^(65[0-4]|67\d|68\d)\d{6}$/.test(local)
  }
  return /^(65[5-9]|69\d)\d{6}$/.test(local)
}

function getProviderHint(provider: 'mtn' | 'orange'): string {
  return provider === 'orange'
    ? 'Préfixes Orange: 655-659, 69x'
    : 'Préfixes MTN: 650-654, 67x, 68x'
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  onSubmit,
  method,
  submitError
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PaymentMethodForm) => Promise<void> | void
  method?: PaymentMethod | null
  submitError?: string | null
}) {
  const { t } = useI18n()
  const schema = useMemo(
    () =>
      z.object({
        provider: z.enum(['mtn', 'orange']),
        externalId: z
          .string()
          .min(1, 'Le numéro Mobile Money est requis.')
          .transform(value => value.trim()),
        holderName: z
          .string()
          .min(1, t('payments.methods.validation.holderNameRequired'))
          .transform(value => value.trim()),
        label: z
          .string()
          .max(120, t('payments.methods.validation.labelTooLong'))
          .transform(value => value.trim())
          .optional(),
        isDefault: z.union([z.boolean(), z.literal('on')]).optional()
      })
      .superRefine((data, ctx) => {
        const normalized = normalizeCameroonMobileNumber(data.externalId)
        if (!normalized) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['externalId'],
            message: 'Numéro camerounais invalide. Format: +2376XXXXXXXX.'
          })
          return
        }
        if (!isProviderPhonePrefixMatch(data.provider, normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['externalId'],
            message:
              data.provider === 'orange'
                ? 'Numéro Orange Money invalide (préfixes Orange attendus).'
                : 'Numéro MTN Mobile Money invalide (préfixes MTN attendus).'
          })
        }
      })
      .transform(data => ({
        ...data,
        externalId: normalizeCameroonMobileNumber(data.externalId) as string
      })),
    [t]
  )
  const resolver = useMemo(() => zodResolver(schema), [schema])
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset
  } = useForm<PaymentMethodForm>({
    resolver,
    defaultValues: method
      ? {
          provider: method.provider?.toLowerCase() === 'orange' ? 'orange' : 'mtn',
          externalId: method.externalId ?? '',
          holderName: method.holderName ?? '',
          label: method.label ?? '',
          isDefault: method.isDefault
        }
      : { provider: 'mtn', externalId: '', holderName: '', label: '', isDefault: false }
  })

  const onSubmitForm = async (data: PaymentMethodForm) => {
    const isDefault =
      data.isDefault === true || data.isDefault === 'on'
    const holderName = data.holderName.trim()
    const label =
      data.label && data.label.length > 0 ? data.label.trim() : undefined

    await onSubmit({
      ...data,
      externalId: data.externalId,
      holderName,
      label,
      isDefault
    })
    reset({
      provider: data.provider,
      externalId: data.externalId,
      holderName,
      label: data.label ?? '',
      isDefault
    })
  }

  const providerValue = watch('provider') ?? 'mtn'

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={
        method ? t('payments.methods.modal.editTitle') : t('payments.methods.modal.addTitle')
      }
    >
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <FormField label={t('payments.methods.form.type')} htmlFor="type">
          <input type="hidden" {...register('provider')} />
          <Select
            id="type"
            value={providerValue}
            onChange={value =>
              setValue('provider', String(value) as 'mtn' | 'orange', {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={[
              { value: 'mtn', label: 'MTN Mobile Money' },
              { value: 'orange', label: 'Orange Money' }
            ]}
          />
        </FormField>
        <FormField
          label="Numéro Mobile Money"
          htmlFor="externalId"
          hint={getProviderHint(providerValue)}
          error={errors.externalId?.message ?? submitError ?? undefined}
        >
          <Input
            id="externalId"
            {...register('externalId')}
            placeholder="+2376XXXXXXXX"
          />
        </FormField>
        <FormField
          label={t('payments.methods.form.holderName')}
          htmlFor="holderName"
          error={errors.holderName?.message}
        >
          <Input id="holderName" {...register('holderName')} placeholder={t('payments.methods.form.holderNamePlaceholder')} />
        </FormField>
        <FormField label={t('payments.methods.form.label')} htmlFor="label" error={errors.label?.message}>
          <Input
            id="label"
            {...register('label')}
            placeholder={t('payments.methods.form.labelPlaceholder')}
          />
        </FormField>
        <label
          htmlFor="isDefault"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            fontSize: '0.95rem'
          }}
        >
          <input id="isDefault" type="checkbox" {...register('isDefault')} />
          {t('payments.methods.form.setDefault')}
        </label>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            marginTop: '1.5rem'
          }}
        >
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
