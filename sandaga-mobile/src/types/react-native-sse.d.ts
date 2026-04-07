declare module 'react-native-sse' {
  type EventSourceOptions = {
    headers?: Record<string, string>
  }

  export default class EventSource {
    constructor(url: string, options?: EventSourceOptions)
    addEventListener(type: string, listener: (event: { data?: string }) => void): void
    removeEventListener(type: string, listener: (event: { data?: string }) => void): void
    close(): void
  }
}
