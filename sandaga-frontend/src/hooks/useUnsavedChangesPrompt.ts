import { useCallback, useContext, useEffect } from 'react'
import { useBeforeUnload, UNSAFE_NavigationContext } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

export function useUnsavedChangesPrompt(hasUnsavedChanges: boolean, message?: string) {
  const navigation = useContext(UNSAFE_NavigationContext)
  const { t } = useI18n()
  const promptMessage = message ?? t('navigation.unsavedChanges')

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!hasUnsavedChanges) {
          return
        }
        event.preventDefault()
        event.returnValue = promptMessage
      },
      [hasUnsavedChanges, promptMessage]
    ),
    { capture: true }
  )

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined
    }
    const navigator = navigation?.navigator as
      | {
          block?: (blocker: (tx: { retry: () => void }) => void) => () => void
        }
      | undefined
    if (!navigator?.block) {
      return undefined
    }

    const unblock = navigator.block((tx: { retry: () => void }) => {
      const autoUnblockingTx = {
        ...tx,
        retry() {
          unblock()
          tx.retry()
        }
      }

      const proceed = window.confirm(promptMessage)
      if (proceed) {
        autoUnblockingTx.retry()
      }
    })

    return unblock
  }, [hasUnsavedChanges, navigation, promptMessage])
}
