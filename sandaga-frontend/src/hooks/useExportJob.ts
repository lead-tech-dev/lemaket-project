import { useCallback, useEffect, useRef, useState } from 'react'
import {
  downloadExportJob,
  fetchExportJob,
  startExportJob
} from '../utils/admin-api'
import type { ExportJob, ExportJobStatus } from '../types/admin'
import { useI18n } from '../contexts/I18nContext'

type ExportFormat = 'csv' | 'xlsx'

type UseExportJobOptions = {
  onStart?: () => void
  onDownload?: (filename: string) => void
  onError?: (message: string) => void
}

type UseExportJobResult = {
  startExport: (format: ExportFormat) => Promise<void>
  status: ExportJobStatus | 'idle'
  progress: number
  isRunning: boolean
  format: ExportFormat | null
  error: string | null
}

export function useExportJob(
  scope: string,
  { onStart, onDownload, onError }: UseExportJobOptions = {}
): UseExportJobResult {
  const { t } = useI18n()
  const [job, setJob] = useState<ExportJob | null>(null)
  const [status, setStatus] = useState<ExportJobStatus | 'idle'>('idle')
  const [progress, setProgress] = useState(0)
  const [format, setFormat] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => clearPoll, [clearPoll])

  const pollJob = useCallback(
    (jobId: string) => {
      clearPoll()
      pollRef.current = window.setInterval(async () => {
        try {
          const next = await fetchExportJob(jobId)
          setJob(next)
          setStatus(next.status)
          setProgress(Math.round((next.progress ?? 0) * 100))

          if (next.status === 'completed') {
            clearPoll()
            setProgress(100)
            const file = await downloadExportJob(next.id, status =>
              t('exports.error.download', { status })
            )
            const url = URL.createObjectURL(file.blob)
            const link = document.createElement('a')
            link.href = url
            link.download = file.filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
            onDownload?.(file.filename)
            setStatus('idle')
            setJob(null)
            setFormat(null)
            setProgress(0)
          } else if (next.status === 'failed') {
            clearPoll()
            const message = next.error ?? t('exports.error.generic')
            setError(message)
            onError?.(message)
            setStatus('idle')
            setJob(null)
            setFormat(null)
            setProgress(0)
          }
        } catch (err) {
          console.error('Export polling failed', err)
          clearPoll()
          const message =
            err instanceof Error
              ? err.message
              : t('exports.error.progress')
          setError(message)
          onError?.(message)
          setStatus('idle')
          setJob(null)
          setFormat(null)
          setProgress(0)
        }
      }, 1000)
    },
    [clearPoll, onDownload, onError, t]
  )

  const startExport = useCallback(
    async (requestedFormat: ExportFormat) => {
      if (status === 'in_progress' || status === 'pending') {
        return
      }
      setError(null)
      setFormat(requestedFormat)
      setStatus('pending')
      setProgress(0)
      onStart?.()

      try {
        const created = await startExportJob(scope, requestedFormat)
        setJob(created)
        setStatus(created.status)
        pollJob(created.id)
      } catch (err) {
        console.error('Unable to start export job', err)
        const message =
          err instanceof Error
            ? err.message
            : t('exports.error.start')
        setError(message)
        onError?.(message)
        setStatus('idle')
        setFormat(null)
      }
    },
    [status, onStart, scope, onError, pollJob, t]
  )

  const isRunning = status === 'pending' || status === 'in_progress'

  return {
    startExport,
    status,
    progress,
    isRunning,
    format,
    error
  }
}
