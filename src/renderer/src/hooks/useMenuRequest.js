import { useEffect, useRef } from 'react'
import { useMenuStore } from '../store/menuStore'

/**
 * Run `handler` when the macOS menu requests `command`, also for a request made
 * before this component mounted. The handler is read when it runs, so it sees the
 * component's current state. Call it above any early `return` (rules of hooks).
 */
export function useMenuRequest(command, handler) {
  const pending = useMenuStore((s) => s.pending[command])
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (pending === undefined) return
    if (useMenuStore.getState().take(command)) ref.current()
  }, [pending, command])
}
