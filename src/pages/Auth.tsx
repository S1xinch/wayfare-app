import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, didSignIn } from '../account'

export type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

const TITLE: Record<Mode, string> = { login: 'Sign in', register: 'Create account', forgot: 'Forgot password', reset: 'Choose a new password', verify: 'Verify email' }
const BUTTON: Record<Mode, string> = { login: 'Sign in', register: 'Create account', forgot: 'Send reset link', reset: 'Save password', verify: '' }

export default function Auth({ mode }: { mode: Mode }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const tok = params.get('token') ?? ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const ran = useRef(false)

  async function call(body: Record<string, string>) {
    setBusy(true); setError('')
    try {
      const r = await api(`/api/auth/${mode}`, 'POST', body)
      if (!r.ok) setError(r.data.error ?? 'Something went wrong. Try again.')
      return r
    } catch {
      setError(navigator.onLine ? 'Could not reach the server. Try again.' : 'You are offline. Connect to continue.')
      return null
    } finally { setBusy(false) }
  }

  // Verification runs from the page (a POST), so email link scanners can't verify an address by pre-opening the link.
  useEffect(() => {
    if (mode !== 'verify' || ran.current) return
    ran.current = true
    call({ token: tok }).then((r) => r?.ok && setDone('Your email is verified. You can sign in now.'))
  }, [])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const r = await call(mode === 'reset' ? { password: f.password, token: tok } : f)
    if (!r?.ok) return
    if (mode === 'login') { didSignIn(f.email.trim().toLowerCase()); nav('/') }
    else if (mode === 'reset') setDone('Password changed. You can sign in now.')
    else setDone(r.data.message)
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6">{TITLE[mode]}</h1>

      {mode === 'verify' && !done && !error && <p role="status">Verifying…</p>}
      {done && (
        <div role="status" className="card mb-4">
          <p>{done}</p>
          {mode !== 'register' && mode !== 'forgot' && <Link to="/login" className="btn mt-3 inline-block text-center">Sign in</Link>}
        </div>
      )}
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}

      {mode !== 'verify' && !done && (
        <form onSubmit={submit} className="space-y-5">
          {mode !== 'reset' && (
            <label className="label">Email
              <input className="input mt-1 font-normal" name="email" type="email" required autoComplete="email" maxLength={254} />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="label">{mode === 'login' ? 'Password' : 'New password'}
              <input className="input mt-1 font-normal" name="password" type="password" required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'login' ? undefined : 10} maxLength={72} />
              {mode !== 'login' && <span className="caption block font-normal">At least 10 characters.</span>}
            </label>
          )}
          <button className="btn w-full" disabled={busy || (mode === 'reset' && !tok)}>{busy ? 'Please wait…' : BUTTON[mode]}</button>
        </form>
      )}

      <p className="caption mt-6 space-x-3">
        {mode === 'login' && <><Link to="/register" className="underline">Create account</Link><Link to="/forgot" className="underline">Forgot password?</Link></>}
        {mode !== 'login' && <Link to="/login" className="underline">Back to sign in</Link>}
      </p>
      {(mode === 'login' || mode === 'register') && (
        <p className="caption mt-4">Accounts are optional. Without one, Wayfare keeps your trips on this device only. With one, they sync across your devices.</p>
      )}
    </div>
  )
}
