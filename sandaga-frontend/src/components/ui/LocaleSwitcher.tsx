import { useI18n } from '../../contexts/I18nContext'
import type { Locale } from '../../i18n/translations'
import { Select } from './Select'

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="locale-switcher">
      <Select
        label={t('locale.switcherLabel')}
        value={locale}
        onChange={value => setLocale(value as Locale)}
        options={[
          { value: 'fr', label: 'FR' },
          { value: 'en', label: 'EN' }
        ]}
      />
    </div>
  )
}
