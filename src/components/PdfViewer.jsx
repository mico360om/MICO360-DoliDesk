import { useEffect, useState } from 'react'

// Full-screen modal that renders a PDF in-app using Chromium's built-in
// viewer. `doc` is { filename, type, content (base64) }. Builds a blob URL
// (revoked on close) so large PDFs render efficiently.
function base64ToBlob(b64, type) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: type || 'application/pdf' })
}

export default function PdfViewer({ doc, title, onClose, onDownload }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!doc?.content) return
    let objUrl
    try {
      objUrl = URL.createObjectURL(base64ToBlob(doc.content, doc.type))
      setUrl(objUrl)
    } catch {
      setError(true)
    }
    return () => objUrl && URL.revokeObjectURL(objUrl)
  }, [doc])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/80 p-4">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
            📄 {title || doc?.filename || 'Document'}
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button className="btn-outline py-1.5" onClick={onDownload}>⬇ Download</button>
            )}
            <button className="btn-ghost py-1.5" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 dark:bg-slate-800">
          {error ? (
            <div className="grid h-full place-items-center text-sm text-slate-500">Could not display this PDF.</div>
          ) : url ? (
            <iframe src={url} title="PDF preview" className="h-full w-full border-0" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-500">Loading…</div>
          )}
        </div>
      </div>
    </div>
  )
}
