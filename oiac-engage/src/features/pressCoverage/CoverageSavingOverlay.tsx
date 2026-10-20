import { LuLoaderCircle } from 'react-icons/lu'

export default function CoverageSavingOverlay() {
  return <div className="loading-backdrop coverage-saving" role="status" aria-live="polite" aria-label="Saving Press Coverage" aria-busy="true">
    <div className="loading-backdrop__panel coverage-saving__panel"><LuLoaderCircle aria-hidden="true" /><div><strong>Saving Press Coverage</strong><p>Please wait while your Press Coverage record is being saved.</p></div></div>
  </div>
}
