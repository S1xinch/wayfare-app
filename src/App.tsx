import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import TripDetail from './pages/TripDetail'
import { Privacy, Terms } from './pages/Legal'
import Auth from './pages/Auth'
import Account from './pages/Account'
import { useAppSelector } from './store'

const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false)
    addEventListener('online', u); addEventListener('offline', d)
    return () => { removeEventListener('online', u); removeEventListener('offline', d) }
  }, [])
  return on
}

function toggleDark() {
  const dark = document.documentElement.classList.toggle('dark')
  try { localStorage.dark = dark ? '1' : '0' } catch { /* private mode */ }
}

export default function App() {
  const online = useOnline()
  const user = useAppSelector((s) => s.account.user)
  return (
    <>
      <header className="border-b border-neutral-200 dark:border-[#2d333f]">
        <nav aria-label="Main" className="mx-auto flex max-w-[1216px] items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-[#1a202c] dark:text-slate-100">Wayfare</Link>
          <div className="flex items-center gap-3">
            {!online && <span role="status" className="rounded bg-warning px-2 py-1 text-xs font-semibold text-black">Offline</span>}
            <NavLink to="/" className="min-h-11 content-center px-2">Trips</NavLink>
            <NavLink to={user ? '/account' : '/login'} className="min-h-11 content-center px-2">{user ? 'Account' : 'Sign in'}</NavLink>
            <button className="btn btn-secondary" onClick={toggleDark} aria-label="Toggle dark mode">Theme</button>
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-[1216px] px-4 py-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trip/:id" element={<TripDetail />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/forgot" element={<Auth mode="forgot" />} />
          <Route path="/reset" element={<Auth mode="reset" />} />
          <Route path="/verify" element={<Auth mode="verify" />} />
          <Route path="/account" element={<Account />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<p>Page not found. <Link className="underline" to="/">Go home</Link></p>} />
        </Routes>
        {isIOS && !standalone && <p className="caption mt-8">Install: tap Share, then “Add to Home Screen”.</p>}
      </main>
      <footer className="caption mx-auto max-w-[1216px] px-4 pb-6">
        <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/terms" className="underline">Terms</Link>
      </footer>
    </>
  )
}
