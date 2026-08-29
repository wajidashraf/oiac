import { LuLoaderCircle } from 'react-icons/lu'

type LoadingBackdropProps = {
  readonly label?: string
}

export function LoadingBackdrop({ label = 'Loading' }: LoadingBackdropProps) {
  return (
    <div className="loading-backdrop" role="status" aria-live="polite" aria-label={label} aria-busy="true">
      <div className="loading-backdrop__panel">
        <LuLoaderCircle aria-hidden="true" />
        <span>{label}…</span>
      </div>
    </div>
  )
}
