import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { deleteAccount, signOut, syncNow } from '../account'
import { useAppSelector } from '../store'
import Modal from '../components/Modal'

const LABEL = { idle: 'Up to date', syncing: 'Syncing…', error: 'Sync failed. Will retry.', offline: 'Offline. Will sync when you reconnect.' }

export default function Account() {
  const { user, sync, last } = useAppSelector((s) => s.account)
  const nav = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState('')
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6">Account</h1>
      <div className="card mb-5 space-y-2">
        <p>Signed in as <strong>{user}</strong></p>
        <p role="status" className="caption">{LABEL[sync]}{last && sync === 'idle' && <> · last synced <span className="mono">{new Date(last).toLocaleTimeString()}</span></>}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button className="btn" onClick={syncNow} disabled={sync === 'syncing'}>Sync now</button>
          <button className="btn btn-secondary" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
        </div>
        <p className="caption">Signing out keeps your trips on this device; they just stop syncing.</p>
      </div>
      <div className="card">
        <h3 className="mb-2">Delete account</h3>
        <p className="caption mb-3">Removes your account and your synced copy from our server. Trips already on your devices stay there.</p>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Delete account</button>
      </div>

      <Modal open={confirm} onClose={() => { setConfirm(false); setErr('') }} title="Delete your account?">
        <p className="mb-4">This cannot be undone.</p>
        {err && <p role="alert" className="mb-3 text-danger">{err}</p>}
        <div className="flex justify-end gap-3">
          <button autoFocus className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={async () => { (await deleteAccount()) ? nav('/') : setErr('Could not delete. Check your connection and try again.') }}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
