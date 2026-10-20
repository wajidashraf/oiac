import { useEffect, useState } from 'react'
import { FiDownload, FiFileText, FiImage } from 'react-icons/fi'
import { RiFileExcel2Line } from 'react-icons/ri'
import { downloadCoverageFile } from './pressCoverageFiles'

type Props = { id: string; fileName: string }
type Preview = { url: string; fileName: string; mime: string }

// A changed record starts with an empty preview during render, before effects run.
export default function CoverageAttachment(props: Props) {
  return <AttachmentPreview key={`${props.id}:${props.fileName}`} {...props} />
}

function AttachmentPreview({ id, fileName }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let url: string | undefined
    setPreview(null); setError('')
    downloadCoverageFile(id).then(result => {
      if (!active) return
      url = URL.createObjectURL(result.blob)
      setPreview({ url, fileName: result.fileName, mime: result.blob.type })
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'The attachment could not be loaded.')
    })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id, attempt])
  const image = preview?.mime.startsWith('image/')
  const pdf = preview?.mime === 'application/pdf'
  const excel = preview?.mime === 'application/vnd.ms-excel' || preview?.mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const Icon = image ? FiImage : excel ? RiFileExcel2Line : FiFileText
  return <section className="coverage-attachment coverage-field--full" aria-label="Coverage attachment">
    <h3>Attachment</h3>
    <p className="coverage-attachment__name"><Icon aria-label={excel ? 'Excel attachment' : image ? 'Image attachment' : pdf ? 'PDF attachment' : 'File attachment'} role="img" /><span>{preview?.fileName ?? fileName}</span></p>
    {error ? <><p role="alert">Attachment preview unavailable. {error}</p><button type="button" className="button button--quiet" onClick={() => setAttempt(value => value + 1)}>Retry attachment preview</button></> : null}
    {preview ? <>
      {image && !error ? <a href={preview.url} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size ${preview.fileName}`}><img className="coverage-attachment__thumbnail" src={preview.url} width={100} height={100} alt={preview.fileName} onError={() => setError('The image could not be displayed.')} /></a> : null}
      {pdf && !error ? <iframe className="coverage-attachment__pdf" title={`Preview ${preview.fileName}`} src={preview.url} onError={() => setError('The PDF could not be displayed.')} /> : null}
      <div className="coverage-attachment__actions">{excel ? <a href={preview.url} target="_blank" rel="noopener noreferrer">Open {preview.fileName}</a> : null}<a href={preview.url} download={preview.fileName}><FiDownload aria-hidden="true" /> Download {preview.fileName}</a></div>
      {pdf ? <small>If the PDF does not appear, download it to read it.</small> : null}
    </> : !error ? <p role="status">Loading attachment...</p> : null}
  </section>
}
