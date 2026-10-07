'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { CURRENCIES, currencyName } from '@/lib/currencies'
import { useCurrency } from '@/lib/money'
import { initAccount } from './account'
import { loadTrips } from './boot'
import { store } from './store'
import 'leaflet/dist/leaflet.css'
import './wayfare.css'

const toggleDark = () => {
  const dark = document.querySelector('.wf')!.classList.toggle('dark')
  try { localStorage.dark = dark ? '1' : '0' } catch { /* private mode */ }
}

/** Client-only host for the trips area: Redux store, offline data, sync. Renders nothing until local trips are loaded so SSR and first paint agree. */
export default function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  const { cur, setCurrency } = useCurrency()
  useEffect(() => {
    try { setDark(localStorage.dark === '1') } catch { /* private mode */ } // opt-in: only this area themes dark, so don't follow the OS
    loadTrips().then(() => { setReady(true); initAccount() })
  }, [])
  return (
    <Provider store={store}>
      <div className={`wf${dark ? ' dark' : ''}`}>
        <div className="wf-toolbar">
          <label>Currency
            <select className="input" value={cur} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{currencyName(c)}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-plain" aria-pressed={dark} aria-label="Dark mode" title="Dark mode" onClick={() => { toggleDark(); setDark((d) => !d) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {dark ? (
                <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              )}
            </svg>
          </button>
        </div>
        {ready ? children : <p role="status">Loading your trips…</p>}
      </div>
    </Provider>
  )
}
