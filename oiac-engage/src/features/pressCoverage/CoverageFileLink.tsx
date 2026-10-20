import { useEffect, useRef, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { downloadCoverageFile } from './pressCoverageFiles'

export default function CoverageFileLink({ id, fileName, disabled }: { id: string; fileName: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function download() {
    if (lock.current || disabled) return
    lock.current = true; setBusy(true); setError('')
    try {
      const file = await downloadCoverageFile(id)
      if (!mounted.current) return
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = file.fileName
      document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'File could not be downloaded. Try again.')
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return <div className="coverage-row-file">
    <button type="button" disabled={disabled || busy} aria-label={`Download ${fileName}`} onClick={() => { void download() }}>
      <FiDownload aria-hidden="true" /><span>{busy ? 'Downloading…' : fileName}</span>
    </button>
    {error && <p role="alert">{error}</p>}
  </div>
}
