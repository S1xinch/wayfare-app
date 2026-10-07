import { get, set } from 'idb-keyval'
import { deleteTrip, setSync, setTrips, setUser, store } from './store'
import { mergeDeleted, mergeTrips, type Deleted } from './merge'

/** JSON call to our own API. Rejects only on network failure; HTTP errors come back as {ok:false, status, data}. */
export async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

const cache = (email: string | null) => { try { email ? (localStorage.wf_user = email) : localStorage.removeItem('wf_user') } catch { /* private mode */ } }

// ---- sync: one document per account, merged per trip (see merge.ts), pushed with an optimistic revision ----
let deleted: Deleted = {}
let applying = false // true while our own merge result is dispatched, so it doesn't trigger another sync
let running = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

const signedIn = () => !!store.getState().account.user
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const status = (sync: 'idle' | 'syncing' | 'error' | 'offline', last?: string) => store.dispatch(setSync({ sync, last }))

export async function syncNow() {
  if (!signedIn()) return
  if (running) { again = true; return }
  running = true
  status('syncing')
  try {
    for (let i = 0; i < 3; i++) {
      const r = await api('/api/trips')
      if (r.status === 401) return dropUser()
      if (!r.ok) throw new Error('pull failed')
      const doc = r.data.doc as { trips: never[]; deleted: Deleted } | null
      deleted = mergeDeleted(deleted, doc?.deleted ?? {})
      const merged = mergeTrips(store.getState().trips, doc?.trips ?? [], deleted)
      if (!same(merged, store.getState().trips)) { applying = true; store.dispatch(setTrips(merged)); applying = false }
      await set('deleted', deleted)
      if (doc && same(merged, doc.trips) && same(deleted, doc.deleted)) break // already identical to the server
      const p = await api('/api/trips', 'PUT', { rev: r.data.rev, doc: { trips: merged, deleted } })
      if (p.ok) break
      if (p.status !== 409) throw new Error('push failed') // 409: another device synced first, loop to merge again
    }
    status('idle', new Date().toISOString())
  } catch {
    status(navigator.onLine ? 'error' : 'offline')
  } finally {
    running = false
    if (again) { again = false; schedule() }
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(syncNow, 1500)
}

function dropUser() {
  cache(null)
  store.dispatch(setUser(null))
  status('idle')
}

let wired = false

/** Call on every mount of the trips area, after the local trips are loaded. Listeners are attached once; sign-in is re-checked each time (login/logout happen on other pages now). */
export async function initAccount() {
  if (!wired) {
    wired = true
    deleted = (await get('deleted').catch(() => undefined)) ?? {}
    let last = store.getState().trips
    store.subscribe(() => {
      const t = store.getState().trips
      if (t === last) return
      last = t
      if (!applying && signedIn()) schedule()
    })
    addEventListener('online', syncNow)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow() })
  }

  try {
    const me = await api('/api/account')
    if (me.ok) { cache(me.data.email); store.dispatch(setUser(me.data.email)); syncNow() } else if (me.status === 401) dropUser()
  } catch { /* offline or API down: keep the cached sign-in and retry on 'online' */ }
}

/** Delete a trip and remember it, so other devices drop it too instead of syncing it back. */
export async function forgetTrip(id: string) {
  deleted = { ...deleted, [id]: new Date().toISOString() }
  await set('deleted', deleted).catch(() => {})
  store.dispatch(deleteTrip(id))
}
