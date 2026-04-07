import { useEffect, useMemo, useState } from 'react'

export function useClientPagination<T>(items: T[] | undefined, pageSize = 12, resetKey?: string | number) {
  const source = useMemo(() => items ?? [], [items])
  const [visibleCount, setVisibleCount] = useState(pageSize)

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [pageSize, resetKey, source.length])

  const visibleItems = useMemo(() => source.slice(0, visibleCount), [source, visibleCount])
  const hasMore = source.length > visibleCount

  return {
    visibleItems,
    hasMore,
    visibleCount,
    totalCount: source.length,
    loadMore: () => {
      setVisibleCount(current => Math.min(source.length, current + pageSize))
    }
  }
}
