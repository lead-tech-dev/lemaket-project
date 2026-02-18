type Listener = (count: number) => void

let pendingCount = 0
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) {
    listener(pendingCount)
  }
}

export function beginGlobalLoading() {
  pendingCount += 1
  notify()
}

export function endGlobalLoading() {
  if (pendingCount > 0) {
    pendingCount -= 1
    notify()
  }
}

export function resetGlobalLoading() {
  pendingCount = 0
  notify()
}

export function subscribeGlobalLoading(listener: Listener) {
  listeners.add(listener)
  listener(pendingCount)
  return () => {
    listeners.delete(listener)
  }
}
