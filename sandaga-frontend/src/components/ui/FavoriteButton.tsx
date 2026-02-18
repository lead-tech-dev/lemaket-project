import { useCallback, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom'
import { apiDelete, apiPost } from '../../utils/api'
import { useToast } from '../ui/Toast'
import { getAuthToken } from '../../utils/auth-token'
import { useI18n } from '../../contexts/I18nContext'

type FavoriteButtonProps = {
  listingId: string | number;
  initial?: boolean;
  className?: string;
  label?: string;
  onChange?: (next: boolean) => void;
};

export function FavoriteButton({
  listingId,
  initial = false,
  className,
  label,
  onChange
}: FavoriteButtonProps) {
  const { t } = useI18n()
  const [isFavorite, setIsFavorite] = useState<boolean>(initial)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { addToast } = useToast()
  const navigate = useNavigate()

  const handleToggle = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (isLoading) {
        return;
      }

      const token = getAuthToken()
      if (!token) {
        addToast({
          variant: 'error',
          title: t('favorites.authRequiredTitle'),
          message: t('favorites.authRequiredMessage')
        })
        navigate('/login', { replace: true })
        return
      }

      const nextState = !isFavorite
      setIsFavorite(nextState)
      setIsLoading(true)
      setErrorMessage(null)
      onChange?.(nextState)

      try {
        if (nextState) {
          await apiPost(`/favorites/${listingId}`)
        } else {
          await apiDelete(`/favorites/${listingId}`)
        }
      } catch (error) {
        console.error('Unable to update favorites', error)
        const revertState = !nextState
        setIsFavorite(revertState)
        onChange?.(revertState)

        if (
          error instanceof Error &&
          (error.message === 'Unauthorized' || error.message.includes('401'))
        ) {
          addToast({
            variant: 'error',
            title: t('favorites.authRequiredTitle'),
            message: t('favorites.authRequiredMessage')
          })
          navigate('/login', { replace: true })
        } else {
          setErrorMessage(
            t('favorites.error')
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [listingId, isFavorite, isLoading, onChange, addToast, navigate]
  )

  const hasLabel = typeof label === 'string' && label.trim().length > 0
  const buttonClassName = [
    'favorite-toggle',
    hasLabel ? 'favorite-toggle--pill' : null,
    className,
    isFavorite ? 'favorite-toggle--active' : null
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={buttonClassName}
      aria-pressed={isFavorite}
      aria-label={
        isFavorite ? t('favorites.remove') : t('favorites.add')
      }
      title={
        errorMessage ??
        (isFavorite ? t('favorites.remove') : t('favorites.add'))
      }
      onClick={handleToggle}
      disabled={isLoading}
    >
      <svg
        role="img"
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="favorite-toggle__icon"
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 3.99 4 6.5 4c1.74 0 3.41.99 4.22 2.44C11.53 4.99 13.2 4 14.94 4c2.51 0 4.5 2.01 4.5 4.5 0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={isFavorite ? 0 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hasLabel ? <span className="favorite-toggle__label">{label}</span> : null}
      <span className="sr-only">{isFavorite ? t('favorites.remove') : t('favorites.add')}</span>
    </button>
  );
}
