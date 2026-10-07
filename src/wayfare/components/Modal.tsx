import { useEffect, useRef, type ReactNode } from 'react'

// Native <dialog>: focus trap, Esc to close and backdrop come from the platform.
export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}
      className="m-auto w-[calc(100%-32px)] max-w-[500px] rounded-xl bg-white p-8 text-inherit backdrop:bg-black/50 dark:bg-[#17303a]">
      <div className="mb-4 flex items-start justify-between">
        <h2>{title}</h2>
        <button type="button" aria-label="Close" className="min-h-11 min-w-11 text-xl" onClick={onClose}>✕</button>
      </div>
      {open && children}
    </dialog>
  )
}
