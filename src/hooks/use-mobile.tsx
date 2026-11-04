import * as React from "react"
import { DESKTOP_BREAKPOINT_PX, MOBILE_BREAKPOINT_PX } from "@/lib/breakpoints"

// Tailwind `md` breakpoint (768px)
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`

function getMobileMediaQueryList() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY)
}

function subscribeToMobileQuery(onStoreChange: () => void) {
  const mediaQueryList = getMobileMediaQueryList()
  if (!mediaQueryList) return () => undefined
  mediaQueryList.addEventListener("change", onStoreChange)
  return () => mediaQueryList.removeEventListener("change", onStoreChange)
}

function getMobileSnapshot() {
  return getMobileMediaQueryList()?.matches ?? false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    () => false,
  )
}

const COMPACT_NAV_MEDIA_QUERY = `(max-width: ${DESKTOP_BREAKPOINT_PX - 1}px)`

/** Below Tailwind `lg` (1024px): the sidebar is a sheet, not a rail (ZIG-I36 M-17). */
export function useIsCompactNav() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => undefined
      }
      const list = window.matchMedia(COMPACT_NAV_MEDIA_QUERY)
      list.addEventListener("change", onStoreChange)
      return () => list.removeEventListener("change", onStoreChange)
    },
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(COMPACT_NAV_MEDIA_QUERY).matches
        : false,
    () => false,
  )
}
