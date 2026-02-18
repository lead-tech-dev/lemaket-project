import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from './Modal'
import { Button } from './Button'
import { FormField } from './FormField'
import { Input } from './Input'
import type { PaymentMethod } from '../../types/payment'
import { useI18n } from '../../contexts/I18nContext'

export type PaymentMethodForm = {
  type: 'card' | 'wallet' | 'transfer' | 'cash'
  holderName: string
  label?: string
  isDefault?: boolean | 'on'
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  onSubmit,
  method
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PaymentMethodForm) => void
  method?: PaymentMethod | null
}) {
  const { t } = useI18n()
  const schema = useMemo(
    () =>
      z.object({
        type: z.enum(['card', 'wallet', 'transfer', 'cash']),
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
      }),
    [t]
  )
  const resolver = useMemo(() => zodResolver(schema), [schema])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<PaymentMethodForm>({
    resolver,
    defaultValues: method
      ? {
          type: method.type,
          holderName: method.holderName ?? '',
          label: method.label ?? '',
          isDefault: method.isDefault
        }
      : { type: 'card', holderName: '', label: '', isDefault: false }
  })

  const onSubmitForm = (data: PaymentMethodForm) => {
    const isDefault =
      data.isDefault === true || data.isDefault === 'on'
    const holderName = data.holderName.trim()
    const label =
      data.label && data.label.length > 0 ? data.label.trim() : undefined

    onSubmit({
      ...data,
      holderName,
      label,
      isDefault
    })
    reset({
      type: data.type,
      holderName,
      label: data.label ?? '',
      isDefault
    })
  }

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
          <select id="type" {...register('type')}>
            <option value="card">{t('payments.methods.types.card')}</option>
            <option value="wallet">{t('payments.methods.types.wallet')}</option>
            <option value="transfer">{t('payments.methods.types.transfer')}</option>
            <option value="cash">{t('payments.methods.types.cash')}</option>
          </select>
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
