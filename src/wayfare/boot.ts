import { initAccount } from './account'
import { initStore } from './store'

let loaded: Promise<void> | undefined

/** Load the on-device trips once per page load. The store is a module singleton, so every place that touches it (the /trips area, "Add to trip" on flight results) must share this one load. */
export const loadTrips = () => (loaded ??= initStore())

/** loadTrips, then wire sync and re-check sign-in. Call before reading or changing trips outside /trips. */
export const openTrips = () => loadTrips().then(initAccount)
