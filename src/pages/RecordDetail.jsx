import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/ipc.js'
import { getEntity } from '../lib/entities.js'
import { ErrorState, Loading, SafeHtml, Spinner, StatusBadge } from '../components/ui.jsx'
import { useT } from '../lib/i18n.js'
import { humanizeKey, formatMoney, formatNumber } from '../lib/format.js'

// Content fields Dolibarr stores as HTML — rendered (sanitised) rather than escaped.
const HTML_FIELDS = new Set(['note_public', 'note_private', 'note', 'description'])
const isHtml = (v) => typeof v === 'string' && /<[a-z][\s\S]*>/i.test(v)

// Internal / noisy keys we never surface in the "more fields" grid.
const HIDDEN_FIELDS = new Set([
  'id', 'rowid', 'entity', 'import_key', 'array_options', 'array_languages',
  'linkedObjects', 'linkedObjectsIds', 'lines', 'thirdparty', 'contacts_ids',
  'canvas', 'specimen', 'fk_user_author', 'fk_user_modif', 'fk_user_valid',
  'status', 'statut', 'fields', 'context', 'error', 'errors', 'oldcopy',
])

export default function RecordDetail() {
  const { type, id } = useParams()
  const entity = getEntity(type)
  const navigate = useNavigate()
  const t = useT()
  const [record, setRecord] = useState(null)
  const [customer, setCustomer] = useState(null) // { id, name }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [toast, setToast] = useState(null)

  async function downloadPdf() {
    setPdfBusy(true)
    setToast(null)
    try {
      const res = await api.savePdf({ type, id: record.id ?? record.rowid ?? id, ref: record.ref })
      if (res.saved) setToast({ type: 'ok', message: `Saved to ${res.path}` })
    } catch (e) {
      setToast({ type: 'error', message: e.message })
    } finally {
      setPdfBusy(false)
      setTimeout(() => setToast(null), 6000)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      setCustomer(null)
      try {
        const data = await api.get(type, id)
        if (cancelled) return
        setRecord(data)
        // Resolve the linked third party (invoices/orders/proposals).
        const socField = entity?.socField
        const socId = socField && data[socField]
        if (socId) {
          try {
            const map = await api.resolveThirdparties([socId])
            if (!cancelled) setCustomer({ id: String(socId), name: map[String(socId)] })
          } catch {
            /* best-effort */
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [type, id, entity])

  // Scalar fields not already shown in the curated Details section.
  const moreFields = useMemo(() => {
    if (!record || !entity) return []
    const shown = new Set(entity.detailFields)
    return Object.entries(record)
      .filter(([k, v]) => {
        if (shown.has(k) || HIDDEN_FIELDS.has(k)) return false
        if (v === null || v === undefined || v === '') return false
        if (typeof v === 'object') return false // skip arrays/objects — no raw dumps
        return true
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [record, entity])

  if (!entity) return <div className="p-6"><ErrorState title="Unknown record type" message={type} /></div>

  const status = record ? entity.status(record) : null

  function display(v) {
    if (v === null || v === undefined || v === '') return '—'
    return String(v)
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <button className="btn-ghost mb-4 -ml-2" onClick={() => navigate(`/records/${type}`)}>
        ← Back to {entity.label}
      </button>

      {loading ? (
        <Loading label="Loading record…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => navigate(0)} />
      ) : !record ? (
        <ErrorState title="Not found" message="This record could not be loaded." />
      ) : (
        <>
          <div className="card mb-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
                  <span>{entity.icon}</span>
                  <span>{entity.singular}</span>
                  <span>·</span>
                  <span>#{record.id ?? record.rowid ?? id}</span>
                </div>
                <h1 className="truncate text-2xl font-bold text-slate-800 dark:text-slate-100">{entity.title(record)}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  {entity.subtitle(record) && <span>{entity.subtitle(record)}</span>}
                  {customer && (
                    <>
                      {entity.subtitle(record) && <span className="text-slate-300">·</span>}
                      <button
                        className="font-medium text-brand-600 hover:underline"
                        onClick={() => navigate(`/records/thirdparties/${customer.id}`)}
                        title="Open third party"
                      >
                        🏢 {customer.name}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3">
                {status && <StatusBadge label={status.label} tone={status.tone} />}
                {entity.hasLines && (
                  <button className="btn-outline" onClick={downloadPdf} disabled={pdfBusy} title="Download the generated PDF">
                    {pdfBusy ? <Spinner className="h-4 w-4" /> : '⬇'} {t('action.downloadPdf')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Key fields defined per entity */}
          <div className="card mb-5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {entity.detailFields
                .filter((f) => record[f] !== undefined && record[f] !== null && record[f] !== '')
                .map((f) => (
                  <div key={f} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {humanizeKey(f)}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">
                      {HTML_FIELDS.has(f) && isHtml(record[f]) ? <SafeHtml html={record[f]} /> : display(record[f])}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>

          {/* HTML notes (public/private) — rendered, not escaped */}
          {['note_public', 'note_private'].filter((f) => isHtml(record[f])).length > 0 && (
            <div className="card mb-5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
              <div className="space-y-4">
                {['note_public', 'note_private']
                  .filter((f) => record[f] && isHtml(record[f]))
                  .map((f) => (
                    <div key={f}>
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{humanizeKey(f)}</div>
                      <SafeHtml html={record[f]} />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Line items (invoices / orders / proposals) */}
          {Array.isArray(record.lines) && record.lines.length > 0 && (
            <LineItems lines={record.lines} record={record} />
          )}

          {/* Additional scalar fields — formatted, never a raw JSON dump */}
          {moreFields.length > 0 && (
            <div className="card overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setShowMore((s) => !s)}
              >
                <span>More fields ({moreFields.length})</span>
                <span className="text-slate-400">{showMore ? '▲' : '▼'}</span>
              </button>
              {showMore && (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-slate-100 px-6 py-5 dark:border-slate-800 sm:grid-cols-2">
                  {moreFields.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {humanizeKey(k)}
                      </dt>
                      <dd className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">
                        {isHtml(v) ? <SafeHtml html={v} /> : display(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {toast && (
            <div
              className={`pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${
                toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'
              }`}
            >
              {toast.message}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Renders the document's line items (products/services on an invoice, order
// or proposal) as a table, with a totals footer.
function LineItems({ lines, record }) {
  const desc = (l) => l.label || l.product_label || l.desc || l.description || l.ref || '—'
  const currency = record.multicurrency_code

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-700">
        Line items <span className="text-slate-400">({lines.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-6 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unit price</th>
              <th className="px-3 py-2.5 text-right font-semibold">VAT %</th>
              <th className="px-6 py-2.5 text-right font-semibold">Total (excl.)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id ?? l.rowid ?? i} className="border-b border-slate-100 last:border-0">
                <td className="px-6 py-2.5 text-slate-700">
                  {l.ref && <span className="mr-1 font-medium text-slate-500">{l.ref}</span>}
                  {desc(l)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatNumber(l.qty)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatMoney(l.subprice, currency)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                  {l.tva_tx != null && l.tva_tx !== '' ? `${l.tva_tx}%` : '—'}
                </td>
                <td className="px-6 py-2.5 text-right font-medium tabular-nums text-slate-800">
                  {formatMoney(l.total_ht, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-6 py-3 text-sm font-semibold text-slate-600" colSpan={4}>
                Total (incl. tax)
              </td>
              <td className="px-6 py-3 text-right text-base font-bold tabular-nums text-slate-800">
                {formatMoney(record.total_ttc, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
