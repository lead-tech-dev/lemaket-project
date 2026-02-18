import { useMemo } from 'react'
import { Select } from './Select'
import { useI18n } from '../../contexts/I18nContext'

type SortOption = 'recent' | 'priceAsc' | 'priceDesc'

type SortSelectProps = {
  value: SortOption
  onChange: (value: SortOption) => void
  label?: string
  className?: string
  disabled?: boolean
  name?: string
}

export type { SortOption }

export function SortSelect({
  value,
  onChange,
  label,
  className,
  disabled,
  name
}: SortSelectProps) {
  const { t } = useI18n()
  const options = useMemo(
    () => [
      { value: 'recent' as const, label: t('sort.recent') },
      { value: 'priceAsc' as const, label: t('sort.priceAsc') },
      { value: 'priceDesc' as const, label: t('sort.priceDesc') }
    ],
    [t]
  )

  return (
    <Select
      className={className}
      label={label}
      value={value}
      onChange={(value) => onChange(value as SortOption)}
      disabled={disabled}
      name={name}
      options={options}
    />
  )
}
