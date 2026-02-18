import { useMemo, useState } from 'react'
import type { ListingFormFieldOption } from '../../types/listing-form'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useI18n } from '../../contexts/I18nContext'

type BaseProps = {
  options: ListingFormFieldOption[]
  label?: string
  description?: string
  allowMultiple?: boolean
  allowCustomValue?: boolean
  value: string[] | string | null
  onChange: (next: string[] | string | null) => void
}

function normalizeValue(value: string[] | string | null, allowMultiple: boolean): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return allowMultiple ? [value] : value ? [value] : []
}

export function ChoiceChips({
  options,
  allowMultiple = false,
  allowCustomValue = false,
  value,
  onChange
}: BaseProps) {
  const { t } = useI18n()
  const [customValue, setCustomValue] = useState('')
  const selectedValues = useMemo(() => normalizeValue(value, allowMultiple), [value, allowMultiple])

  const toggleSelection = (optionValue: string) => {
    if (allowMultiple) {
      const set = new Set(selectedValues)
      if (set.has(optionValue)) {
        set.delete(optionValue)
      } else {
        set.add(optionValue)
      }
      onChange(Array.from(set))
      return
    }

    onChange(selectedValues.includes(optionValue) ? null : optionValue)
  }

  const handleCustomSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const valueToAdd = customValue.trim()
    if (!valueToAdd) return

    if (allowMultiple) {
      const set = new Set(selectedValues)
      set.add(valueToAdd)
      onChange(Array.from(set))
    } else {
      onChange(valueToAdd)
    }

    setCustomValue('')
  }

  return (
    <div className="choice-chips">
      <div className="choice-chips__grid">
        {options.map(option => {
          const isActive = selectedValues.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              className={`choice-chip ${isActive ? 'choice-chip--active' : ''}`}
              onClick={() => toggleSelection(option.value)}
            >
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          )
        })}
      </div>

      {allowCustomValue ? (
        <form className="choice-chips__custom" onSubmit={handleCustomSubmit}>
          <Input
            value={customValue}
            onChange={event => setCustomValue(event.target.value)}
            placeholder={t('forms.choiceChips.placeholder')}
          />
          <Button type="submit" variant="outline" disabled={!customValue.trim()}>
            {t('forms.choiceChips.add')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
