'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { initAccount } from './account'
import { initStore, store } from './store'
import 'leaflet/dist/leaflet.css'
import './wayfare.css'

let loaded: Promise<void> | undefined // the store is a module singleton: load IndexedDB once per page load, not per visit to /trips

const toggleDark = () => {
  const dark = document.querySelector('.wf')!.classList.toggle('dark')
  try { localStorage.dark = dark ? '1' : '0' } catch { /* private mode */ }
}

/** Client-only host for the trips area: Redux store, offline data, sync. Renders nothing until local trips are loaded so SSR and first paint agree. */
export default function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    try { setDark(localStorage.dark === '1') } catch { /* private mode */ } // opt-in: only this area themes dark, so don't follow the OS
    ;(loaded ??= initStore()).then(() => { setReady(true); initAccount() })
  }, [])
  return (
    <Provider store={store}>
      <div className={`wf${dark ? ' dark' : ''}`}>
        <div className="mb-2 flex justify-end">
          <button className="btn btn-secondary" onClick={() => { toggleDark(); setDark((d) => !d) }} aria-label="Toggle dark mode">Theme</button>
        </div>
        {ready ? children : <p role="status">Loading your trips…</p>}
      </div>
    </Provider>
  )
}
