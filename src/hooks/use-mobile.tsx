import * as React from "react"
import { MOBILE_BREAKPOINT_PX } from "@/lib/breakpoints"

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
