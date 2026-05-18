import * as React from "react"
import { MOBILE_BREAKPOINT_PX } from "@/lib/breakpoints"

// Tailwind `md` breakpoint (768px)
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`

function subscribeToMobileQuery(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
  mediaQueryList.addEventListener("change", onStoreChange)
  return () => mediaQueryList.removeEventListener("change", onStoreChange)
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    () => false,
  )
}
