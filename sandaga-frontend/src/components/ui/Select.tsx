import { useEffect, useMemo, useRef, useState, useId, type KeyboardEvent } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export type SelectOption = {
  value: string | number
  label: string
}

export type SelectOptionGroup = {
  label: string
  values: SelectOption[]
}

type SelectProps = {
  options?: SelectOption[]
  optionGroups?: SelectOptionGroup[]
  value: string | number
  onChange: (value: string | number) => void
  label?: string
  className?: string
  disabled?: boolean
  name?: string
  id?: string
  placeholder?: string
}

export function Select({
  value,
  onChange,
  label,
  className,
  disabled,
  name,
  id,
  options = [],
  optionGroups = [],
  placeholder
}: SelectProps) {
  const { t } = useI18n()
  const [isFocused, setIsFocused] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isKeyboardNav, setIsKeyboardNav] = useState(false)
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const shouldScrollToActiveRef = useRef(false)

  const renderGroups = optionGroups.length > 0
  const groups = renderGroups ? optionGroups : [{ label: '', values: options }]
  const flatOptions = useMemo(
    () => groups.flatMap(group => group.values),
    [groups]
  )
  const valueString = value === undefined || value === null ? '' : String(value)
  const selectedOption = flatOptions.find(option => String(option.value) === valueString) ?? null
  const displayLabel = selectedOption?.label ?? placeholder ?? t('ui.select.placeholder')
  const triggerId = id ?? `${listboxId}-trigger`
  const labelId = label ? `${triggerId}-label` : undefined

  useEffect(() => {
    if (!flatOptions.length) {
      setActiveIndex(0)
      return
    }
    const nextIndex = flatOptions.findIndex(option => String(option.value) === valueString)
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex)
    }
  }, [flatOptions, valueString])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) {
        return
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || flatOptions.length === 0) {
      return
    }
    if (!isKeyboardNav && !shouldScrollToActiveRef.current) {
      return
    }
    const activeId = `${listboxId}-option-${activeIndex}`
    const activeElement = document.getElementById(activeId)
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' })
    }
    shouldScrollToActiveRef.current = false
  }, [isOpen, activeIndex, listboxId, flatOptions.length])

  useEffect(() => {
    if (isOpen) {
      shouldScrollToActiveRef.current = true
    }
  }, [isOpen])

  const handleToggle = () => {
    if (disabled || flatOptions.length === 0) {
      return
    }
    setIsOpen(open => !open)
  }

  const handleSelect = (nextValue: string | number) => {
    if (disabled) {
      return
    }
    onChange(String(nextValue))
    setIsOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return
    }
    if (flatOptions.length === 0) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsKeyboardNav(true)
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setActiveIndex(index => (index + 1) % flatOptions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsKeyboardNav(true)
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setActiveIndex(index => (index - 1 + flatOptions.length) % flatOptions.length)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsKeyboardNav(true)
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      const option = flatOptions[activeIndex]
      if (option) {
        handleSelect(option.value)
      }
      return
    }
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div
      className={['custom-select', className].filter(Boolean).join(' ')}
      ref={containerRef}
    >
      {label ? (
        <label className="custom-select__label" htmlFor={triggerId} id={labelId}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          'custom-select__wrapper',
          isFocused ? 'custom-select__wrapper--focused' : '',
          isOpen ? 'custom-select__wrapper--open' : '',
          disabled ? 'custom-select__wrapper--disabled' : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          id={triggerId}
          className={[
            'custom-select__trigger',
            !selectedOption ? 'custom-select__trigger--placeholder' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && flatOptions.length
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-labelledby={labelId ?? undefined}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          name={name}
        >
          {displayLabel}
        </button>
        <span className="custom-select__chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="custom-select__glow" aria-hidden="true" />
      </div>
      {isOpen ? (
        <div
          className="custom-select__dropdown"
          role="listbox"
          id={listboxId}
          onMouseMove={() => setIsKeyboardNav(false)}
        >
          {flatOptions.length === 0 ? (
            <div className="custom-select__empty">{t('ui.select.empty')}</div>
          ) : (
            groups.map(group => (
              <div key={group.label || 'options'} className="custom-select__group">
                {renderGroups ? (
                  <div className="custom-select__group-label">{group.label}</div>
                ) : null}
                {group.values.map(option => {
                  const optionValue = String(option.value)
                  const optionIndex = flatOptions.findIndex(
                    item => String(item.value) === optionValue
                  )
                  const isSelected = optionValue === valueString
                  const isActive = optionIndex === activeIndex
                  return (
                    <button
                      key={option.value}
                      id={`${listboxId}-option-${optionIndex}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        'custom-select__option',
                        isSelected ? 'custom-select__option--selected' : '',
                        isActive ? 'custom-select__option--active' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => {
                        setIsKeyboardNav(false)
                        setActiveIndex(optionIndex)
                      }}
                    >
                      <span className="custom-select__option-label">{option.label}</span>
                      {isSelected ? (
                        <span className="custom-select__option-check" aria-hidden="true">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
