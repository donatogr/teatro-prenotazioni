import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  getAdminPosti,
  getFile,
  setFilaRiservata,
  setPostoRiservato,
  getExportData,
  getImpostazioni,
  putImpostazioni,
  generaPosti,
} from '../services/api'
import type { Posto, ExportBySeat, ExportByPerson, Impostazioni, GruppoFile } from '../types'
import styles from './AdminPanel.module.css'

/** Formatta timestamp ISO in "gg/mm/aaaa hh:mm" per visualizzazione. */
function formatExportDate(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${h}:${m}`
  } catch {
    return '—'
  }
}

/** Espande "A-G" in [A,B,...,G] o "A,B,C" in lista (per raggruppamento file). */
function espandiLettere(lettere: string): string[] {
  const s = (lettere || '').trim()
  if (!s) return []
  if (s.includes('-')) {
    const [a, b] = s.split('-').map((x) => x.trim())
    if (!a || !b || a.length > 1 || b.length > 1) return []
    const start = a.charCodeAt(0)
    const end = b.charCodeAt(0)
    if (start > end) return []
    const out: string[] = []
    for (let i = start; i <= end; i++) out.push(String.fromCharCode(i))
    return out
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

/** Solo tonalità di rosso per distinguere le persone nella mappa admin. */
const PERSON_COLORS = [
  '#e11d48', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
  '#f87171', '#ef4444', '#be123c', '#9f1239', '#881337',
]

type Tab = 'spettacolo' | 'teatro' | 'mappa' | 'elenco'

interface AdminPanelProps {
  onClose: () => void
  onFileChange?: () => void
}

export function AdminPanel({ onClose, onFileChange }: AdminPanelProps) {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [tab, setTab] = useState<Tab>('spettacolo')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [impostazioni, setImpostazioniState] = useState<Impostazioni | null>(null)
  const [posti, setPosti] = useState<Posto[]>([])
  const [exportData, setExportData] = useState<{ bySeat: ExportBySeat[]; byPerson: ExportByPerson[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [exportLoading, setExportLoading] = useState(false)
  const [exportSearch, setExportSearch] = useState('')
  type SortKey = 'nome' | 'email' | 'count' | 'timestamp'
  const [exportSort, setExportSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const [selectedRow, setSelectedRow] = useState<ExportByPerson | null>(null)
  const [lastExportAt, setLastExportAt] = useState<Date | null>(null)
  const [newCountBadge, setNewCountBadge] = useState<number>(0)
  const prevExportTotalRef = useRef(0)

  const loadPosti = useCallback(() => {
    if (!password) return
    setLoading(true)
    getAdminPosti(password)
      .then(setPosti)
      .catch((e) => setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina o controlla la connessione.'))
      .finally(() => setLoading(false))
  }, [password])

  const loadImpostazioni = useCallback(() => {
    if (!password) return
    getImpostazioni(password)
      .then(setImpostazioniState)
      .catch(() => {
        setImpostazioniState(null)
        setError('Impossibile caricare le impostazioni. Riprova a ricaricare la pagina.')
      })
  }, [password])

  const loadExport = useCallback(() => {
    if (!password) return
    setExportLoading(true)
    setNewCountBadge(0)
    getExportData(password)
      .then((data) => {
        setExportData(data)
        setLastExportAt(new Date())
        const total = data.byPerson.reduce((s, r) => s + r.count, 0)
        if (prevExportTotalRef.current > 0 && total > prevExportTotalRef.current) {
          setNewCountBadge(total - prevExportTotalRef.current)
        }
        prevExportTotalRef.current = total
      })
      .catch(() => {
        setExportData(null)
        setError('Impossibile caricare l\'elenco. Riprova a ricaricare la pagina o controlla la connessione.')
      })
      .finally(() => setExportLoading(false))
  }, [password])

  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(''), 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  const checkAuth = useCallback(() => {
    if (!password) return
    setError('')
    getFile(password)
      .then(() => {
        setAuthenticated(true)
        loadImpostazioni()
      })
      .catch((e) => setError((e instanceof Error ? e.message : 'Non autorizzato') + ' Riprova o controlla la connessione.'))
  }, [password, loadImpostazioni])

  useEffect(() => {
    if (!authenticated) return
    if (tab === 'spettacolo') loadImpostazioni()
    if (tab === 'teatro') loadImpostazioni()
    if (tab === 'mappa') {
      loadPosti()
      loadExport()
    }
    if (tab === 'elenco') loadExport()
  }, [authenticated, tab, loadImpostazioni, loadPosti, loadExport])

  const byFila = useMemo(() => {
    const acc: Record<string, Posto[]> = {}
    posti.forEach((p) => {
      if (!acc[p.fila]) acc[p.fila] = []
      acc[p.fila].push(p)
    })
    return acc
  }, [posti])

  /** Sezioni per raggruppamento file (come in TeatroMap). Usa impostazioni.gruppi_file. */
  const sezioniAdmin = useMemo(() => {
    const gruppiFile = impostazioni?.gruppi_file ?? []
    const tutteLeFile = Object.keys(byFila).sort()
    if (!gruppiFile.length) return [{ nomeGruppo: null as string | null, file: tutteLeFile }]
    const assegnate = new Set<string>()
    const result: { nomeGruppo: string | null; file: string[] }[] = []
    for (const g of gruppiFile) {
      const lettere = espandiLettere(g.lettere)
      const fileInGruppo = lettere.filter((f) => byFila[f]).sort()
      fileInGruppo.forEach((f) => assegnate.add(f))
      if (fileInGruppo.length) result.push({ nomeGruppo: g.nome || g.lettere, file: fileInGruppo })
    }
    const altre = tutteLeFile.filter((f) => !assegnate.has(f))
    if (altre.length) result.push({ nomeGruppo: 'Altri', file: altre })
    return result
  }, [impostazioni?.gruppi_file, byFila])

  const personColorMap = useMemo(() => {
    const m = new Map<string, string>()
    let i = 0
    posti.forEach((p) => {
      if (p.stato === 'occupato' && (p.prenotazione_nome != null || p.prenotazione_email != null)) {
        const key = `${p.prenotazione_nome ?? ''}\0${p.prenotazione_email ?? ''}`
        if (!m.has(key)) m.set(key, PERSON_COLORS[i++ % PERSON_COLORS.length])
      }
    })
    return m
  }, [posti])

  const exportFilteredAndSorted = useMemo(() => {
    if (!exportData?.byPerson.length) return []
    const q = exportSearch.trim().toLowerCase()
    let list = q
      ? exportData.byPerson.filter(
          (r) =>
            (r.nome ?? '').toLowerCase().includes(q) ||
            (r.nome_allieva ?? '').toLowerCase().includes(q) ||
            (r.email ?? '').toLowerCase().includes(q)
        )
      : [...exportData.byPerson]
    if (exportSort) {
      list = [...list].sort((a, b) => {
        let cmp: number
        if (exportSort.key === 'count') cmp = a.count - b.count
        else if (exportSort.key === 'timestamp') {
          const ta = a.timestamp ?? ''
          const tb = b.timestamp ?? ''
          cmp = ta.localeCompare(tb)
        } else cmp = (exportSort.key === 'nome' ? (a.nome ?? '') : (a.email ?? '')).localeCompare(exportSort.key === 'nome' ? (b.nome ?? '') : (b.email ?? ''))
        return exportSort.dir * cmp
      })
    }
    return list
  }, [exportData?.byPerson, exportSearch, exportSort])

  const exportSummary = useMemo(() => {
    if (!exportData) return null
    const nPersone = exportData.byPerson.length
    const nPosti = exportData.byPerson.reduce((s, r) => s + r.count, 0)
    return { nPersone, nPosti }
  }, [exportData])

  const toggleFila = async (fila: string) => {
    const postiInFila = posti.filter((p) => p.fila === fila)
    const next = !postiInFila.some((p) => p.riservato_staff)
    setError('')
    try {
      await setFilaRiservata(fila, next, password)
      loadPosti()
      onFileChange?.()
    } catch (e) {
      setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina.')
    }
  }

  const togglePosto = async (p: Posto) => {
    if (p.stato === 'occupato') return
    setError('')
    try {
      await setPostoRiservato(p.id, !p.riservato_staff, password)
      loadPosti()
      onFileChange?.()
    } catch (e) {
      setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina.')
    }
  }

  const saveSpettacolo = async (form: Partial<Impostazioni>) => {
    setSaving(true)
    setError('')
    try {
      await putImpostazioni(password, form)
      setSuccess('')
      setToastMessage('Salvato')
      loadImpostazioni()
    } catch (e) {
      setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina o controlla la connessione.')
    } finally {
      setSaving(false)
    }
  }

  const saveTeatro = async (form: Partial<Impostazioni>) => {
    setSaving(true)
    setError('')
    try {
      await putImpostazioni(password, form)
      setSuccess('')
      setToastMessage('Salvato')
      loadImpostazioni()
    } catch (e) {
      setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina o controlla la connessione.')
    } finally {
      setSaving(false)
    }
  }

  const handleGeneraPosti = async () => {
    const n = (impostazioni?.numero_file ?? 0) * (impostazioni?.posti_per_fila ?? 0)
    if (!window.confirm(`Verranno creati ${n} posti. I posti esistenti saranno sostituiti (solo se non ci sono prenotazioni). Continuare?`)) return
    setError('')
    try {
      const r = await generaPosti(password)
      setToastMessage(`Creati ${r.creati} posti`)
      setTab('mappa')
      loadPosti()
      loadImpostazioni()
      onFileChange?.()
    } catch (e) {
      setError((e instanceof Error ? e.message : 'Errore') + ' Riprova a ricaricare la pagina.')
    }
  }

  const exportPdf = () => {
    if (!exportData) return
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      let y = 15
      const lineH = 6
      doc.setFontSize(14)
      doc.text('Elenco posti prenotati', 14, y)
      y += lineH + 4
      doc.setFontSize(10)
      if (exportData.bySeat.length === 0) {
        doc.text('Nessuna prenotazione.', 14, y)
      } else {
        exportData.bySeat.forEach((r) => {
          if (y > 270) {
            doc.addPage()
            y = 15
          }
          doc.text(`${r.posto} – ${r.nome}${r.nome_allieva ? ` – Allieva: ${r.nome_allieva}` : ''} – ${r.email}`, 14, y)
          y += lineH
        })
      }
      y += 8
      doc.setFontSize(14)
      doc.text('Riepilogo per persona', 14, y)
      y += lineH + 4
      doc.setFontSize(10)
      exportData.byPerson.forEach((r) => {
        if (y > 270) {
          doc.addPage()
          y = 15
        }
        doc.text(`${r.nome}${r.nome_allieva ? ` – Allieva: ${r.nome_allieva}` : ''} (${r.email}) – ${r.count} posto/i: ${r.posti.join(', ')}`, 14, y)
        y += lineH
      })
      doc.save('prenotazioni-teatro.pdf')
      setToastMessage('PDF scaricato')
    })
  }

  const stampaLista = () => {
    if (!exportData) return
    const win = window.open('', '_blank')
    if (!win) return
    const rowsByPerson = exportData.byPerson
      .map((r) => `<tr><td>${r.nome}</td><td>${r.nome_allieva ?? ''}</td><td>${r.email}</td><td>${r.count}</td><td>${r.posti.join(', ')}</td></tr>`)
      .join('')
    const rowsBySeat = exportData.bySeat
      .map((r) => `<tr><td>${r.posto}</td><td>${r.nome}</td><td>${r.nome_allieva ?? ''}</td><td>${r.email}</td></tr>`)
      .join('')
    win.document.write(`
      <!DOCTYPE html><html><head><title>Prenotazioni</title><meta charset="utf-8"></head><body>
      <h1>Elenco prenotazioni</h1>
      <h2>Per posto</h2>
      <table border="1" cellpadding="6"><thead><tr><th>Posto</th><th>Nome</th><th>Allieva</th><th>Email</th></tr></thead><tbody>${rowsBySeat}</tbody></table>
      <h2>Per persona</h2>
      <table border="1" cellpadding="6"><thead><tr><th>Nome</th><th>Allieva</th><th>Email</th><th>N. posti</th><th>Posti</th></tr></thead><tbody>${rowsByPerson}</tbody></table>
      </body></html>`)
    win.document.close()
    win.print()
    win.close()
    setToastMessage('Apri la finestra di stampa per stampare')
  }

  if (!authenticated) {
    const authError = error ? (error.includes('autorizzato') || error === 'Non autorizzato' ? 'Password errata. Riprova.' : error) : ''
    return (
      <div className={styles.overlay}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Accesso amministrazione</h2>
            <button
              type="button"
              className={styles.closeBtnHeader}
              onClick={onClose}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-password">Password admin</label>
            <div className={styles.fieldRow}>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
                placeholder="Password"
                autoComplete="current-password"
              />
              <button type="button" onClick={checkAuth} className={styles.accediBtn}>
                Accedi
              </button>
            </div>
          </div>
          {authError && <p className={styles.error} role="alert">{authError}</p>}
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  const imp = impostazioni || {
    nome_teatro: '',
    indirizzo_teatro: '',
    nome_spettacolo: '',
    data_ora_evento: null,
    numero_file: null,
    posti_per_fila: null,
    gruppi_file: [],
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'spettacolo', label: 'Dati spettacolo' },
    { id: 'teatro', label: 'Caratteristiche teatro' },
    { id: 'mappa', label: 'Mappa e prenotazioni' },
    { id: 'elenco', label: 'Elenco prenotazioni' },
  ]

  return (
    <div className={styles.overlay}>
      <div className={styles.panelAdmin}>
        <div className={styles.panelHeader}>
          <h2>Pannello admin</h2>
          <button
            type="button"
            className={styles.closeBtnHeader}
            onClick={onClose}
            aria-label="Esci e chiudi pannello"
          >
            Esci
          </button>
        </div>
        <div className={styles.tabs} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status">{success}</p>}
        {toastMessage && <div className={styles.toast} role="status">{toastMessage}</div>}

        <div className={styles.adminLayout}>
          <div className={styles.adminMain}>
            {tab === 'spettacolo' && (
              <SpettacoloForm
                imp={imp}
                saving={saving}
                onSave={saveSpettacolo}
              />
            )}

            {tab === 'teatro' && (
              <TeatroForm
                imp={imp}
                saving={saving}
                onSave={saveTeatro}
                onGeneraPosti={handleGeneraPosti}
              />
            )}

            {tab === 'mappa' && (
              <MappaPrenotazioni
                posti={posti}
                byFila={byFila}
                sezioni={sezioniAdmin}
                personColorMap={personColorMap}
                loading={loading}
                onToggleFila={toggleFila}
                onTogglePosto={togglePosto}
              />
            )}

            {tab === 'elenco' && (
              <div className={styles.elencoSection}>
                <h3 className={styles.elencoTitle}>Elenco prenotazioni</h3>
                <button
                  type="button"
                  className={styles.exportLoadBtn}
                  onClick={loadExport}
                  disabled={exportLoading}
                  aria-label="Aggiorna elenco prenotazioni"
                >
                  {exportLoading ? 'Aggiornamento...' : 'Aggiorna elenco'}
                </button>
                {lastExportAt && !exportLoading && (
                  <p className={styles.lastExportAt}>
                    Elenco aggiornato alle {lastExportAt.getHours().toString().padStart(2, '0')}:{lastExportAt.getMinutes().toString().padStart(2, '0')}
                  </p>
                )}
                {newCountBadge > 0 && (
                  <p className={styles.newCountBadge}>{newCountBadge} nuove prenotazioni</p>
                )}
                {exportLoading && (
                  <div className={styles.exportTableWrap}>
                    <div className={styles.skeletonTable}>
                      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className={styles.skeletonRow} />
                      ))}
                    </div>
                  </div>
                )}
                {!exportLoading && exportData && (
                  <>
                    {exportSummary && (
                      <p className={styles.exportSummary}>
                        Totale: <strong>{exportSummary.nPersone}</strong> prenotazioni, <strong>{exportSummary.nPosti}</strong> posti
                      </p>
                    )}
                    <input
                      type="search"
                      className={styles.exportSearch}
                      placeholder="Cerca per nome o email..."
                      value={exportSearch}
                      onChange={(e) => setExportSearch(e.target.value)}
                      aria-label="Cerca nell'elenco prenotazioni"
                    />
                    <div className={styles.exportTableWrap}>
                      <table className={styles.exportTable}>
                        <thead>
                          <tr>
                            <th>
                              <button type="button" className={styles.thSort} onClick={() => setExportSort((s) => (s?.key === 'nome' ? { key: 'nome', dir: (s.dir * -1) as 1 | -1 } : { key: 'nome', dir: 1 }))}>
                                Nome {exportSort?.key === 'nome' ? (exportSort.dir === 1 ? '↑' : '↓') : ''}
                              </button>
                            </th>
                            <th>Allieva</th>
                            <th>
                              <button type="button" className={styles.thSort} onClick={() => setExportSort((s) => (s?.key === 'email' ? { key: 'email', dir: (s.dir * -1) as 1 | -1 } : { key: 'email', dir: 1 }))}>
                                Email {exportSort?.key === 'email' ? (exportSort.dir === 1 ? '↑' : '↓') : ''}
                              </button>
                            </th>
                            <th>
                              <button type="button" className={styles.thSort} onClick={() => setExportSort((s) => (s?.key === 'count' ? { key: 'count', dir: (s.dir * -1) as 1 | -1 } : { key: 'count', dir: -1 }))}>
                                N. {exportSort?.key === 'count' ? (exportSort.dir === 1 ? '↑' : '↓') : ''}
                              </button>
                            </th>
                            <th>
                              <button type="button" className={styles.thSort} onClick={() => setExportSort((s) => (s?.key === 'timestamp' ? { key: 'timestamp', dir: (s.dir * -1) as 1 | -1 } : { key: 'timestamp', dir: -1 }))}>
                                Data {exportSort?.key === 'timestamp' ? (exportSort.dir === 1 ? '↑' : '↓') : ''}
                              </button>
                            </th>
                            <th>Posti</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportFilteredAndSorted.length === 0 ? (
                            <tr>
                              <td colSpan={6} className={styles.exportEmpty}>
                                {exportData.byPerson.length === 0 ? 'Nessuna prenotazione' : 'Nessun risultato per la ricerca'}
                              </td>
                            </tr>
                          ) : (
                            exportFilteredAndSorted.map((r, i) => {
                              const personKey = `${r.nome}\0${r.email}`
                              const cellColor = personColorMap.get(personKey)
                              return (
                                <tr
                                  key={i}
                                  className={styles.exportRowClickable}
                                  onClick={() => setSelectedRow(r)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === 'Enter' && setSelectedRow(r)}
                                  aria-label={`Dettaglio ${r.nome} ${r.email}`}
                                >
                                  <td>{r.nome}</td>
                                  <td>{r.nome_allieva ?? ''}</td>
                                  <td>{r.email}</td>
                                  <td className={cellColor ? styles.countCellColored : undefined} style={cellColor ? { backgroundColor: cellColor, borderColor: cellColor } : undefined}>
                                    {r.count}
                                  </td>
                                  <td>{formatExportDate(r.timestamp)}</td>
                                  <td>{r.posti.join(', ')}</td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.buttonRow}>
                      <button type="button" className={styles.pdfBtn} onClick={exportPdf} aria-label="Esporta elenco in PDF">
                        Esporta PDF
                      </button>
                      <button type="button" className={styles.printBtn} onClick={stampaLista} aria-label="Stampa lista prenotazioni">
                        <span aria-hidden="true">🖨</span> Stampa lista
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedRow && (
          <div className={styles.rowDrawerOverlay} onClick={() => setSelectedRow(null)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Escape' && setSelectedRow(null)} aria-label="Chiudi dettaglio">
            <div className={styles.rowDrawer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.rowDrawerHeader}>
                <h4>Dettaglio prenotazione</h4>
                <button type="button" className={styles.rowDrawerClose} onClick={() => setSelectedRow(null)} aria-label="Chiudi">×</button>
              </div>
              <dl className={styles.rowDrawerBody}>
                <dt>Nome</dt><dd>{selectedRow.nome}</dd>
                {selectedRow.nome_allieva && (<><dt>Allieva</dt><dd>{selectedRow.nome_allieva}</dd></>)}
                <dt>Email</dt><dd>{selectedRow.email}</dd>
                <dt>Data</dt><dd>{formatExportDate(selectedRow.timestamp)}</dd>
                <dt>Posti</dt><dd>{selectedRow.posti.join(', ')}</dd>
              </dl>
              <div className={styles.buttonRow}>
                <button type="button" className={styles.secondaryBtn} onClick={() => { navigator.clipboard.writeText(selectedRow.email); setToastMessage('Email copiata'); }}>
                  Copia email
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => { navigator.clipboard.writeText(selectedRow.posti.join(', ')); setToastMessage('Elenco posti copiato'); }}>
                  Copia elenco posti
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpettacoloForm({
  imp,
  saving,
  onSave,
}: {
  imp: Impostazioni
  saving: boolean
  onSave: (form: Partial<Impostazioni>) => void
}) {
  const [nome_teatro, setNomeTeatro] = useState(imp.nome_teatro)
  const [indirizzo_teatro, setIndirizzoTeatro] = useState(imp.indirizzo_teatro)
  const [nome_spettacolo, setNomeSpettacolo] = useState(imp.nome_spettacolo)
  const [dataOra, setDataOra] = useState(
    imp.data_ora_evento ? imp.data_ora_evento.slice(0, 16) : ''
  )
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    setNomeTeatro(imp.nome_teatro)
    setIndirizzoTeatro(imp.indirizzo_teatro)
    setNomeSpettacolo(imp.nome_spettacolo)
    setDataOra(imp.data_ora_evento ? imp.data_ora_evento.slice(0, 16) : '')
  }, [imp])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDataError('')
    if (dataOra && new Date(dataOra) <= new Date()) {
      setDataError('La data e ora devono essere nel futuro')
      return
    }
    onSave({
      nome_teatro,
      indirizzo_teatro: indirizzo_teatro,
      nome_spettacolo,
      data_ora_evento: dataOra ? `${dataOra}:00` : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formSection}>
      <div className={styles.field}>
        <label htmlFor="nome-teatro">Nome teatro</label>
        <input
          id="nome-teatro"
          type="text"
          value={nome_teatro}
          onChange={(e) => setNomeTeatro(e.target.value)}
          placeholder="Es. Teatro Trivulzio"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="indirizzo-teatro">Indirizzo teatro</label>
        <input
          id="indirizzo-teatro"
          type="text"
          value={indirizzo_teatro}
          onChange={(e) => setIndirizzoTeatro(e.target.value)}
          placeholder="Indirizzo completo"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="nome-spettacolo">Nome spettacolo</label>
        <input
          id="nome-spettacolo"
          type="text"
          value={nome_spettacolo}
          onChange={(e) => setNomeSpettacolo(e.target.value)}
          placeholder="Titolo dell'evento"
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="data-ora">Data e ora evento</label>
        <input
          id="data-ora"
          type="datetime-local"
          value={dataOra}
          onChange={(e) => { setDataOra(e.target.value); setDataError('') }}
          aria-invalid={!!dataError}
          aria-describedby={dataError ? 'data-ora-error' : undefined}
        />
        {dataError && <p id="data-ora-error" className={styles.fieldError}>{dataError}</p>}
      </div>
      <button type="submit" className={styles.primaryBtn} disabled={saving}>
        {saving && <span className={styles.btnSpinner} aria-hidden />}
        {saving ? 'Salvataggio...' : 'Salva'}
      </button>
    </form>
  )
}

function TeatroForm({
  imp,
  saving,
  onSave,
  onGeneraPosti,
}: {
  imp: Impostazioni
  saving: boolean
  onSave: (form: Partial<Impostazioni>) => void
  onGeneraPosti: () => void
}) {
  const [numero_file, setNumeroFile] = useState(imp.numero_file ?? 15)
  const [posti_per_fila, setPostiPerFila] = useState(imp.posti_per_fila ?? 10)
  const [gruppi_file, setGruppiFile] = useState<GruppoFile[]>(imp.gruppi_file || [])
  const [fieldErrors, setFieldErrors] = useState<{ file?: string; posti?: string }>({})

  useEffect(() => {
    setNumeroFile(imp.numero_file ?? 15)
    setPostiPerFila(imp.posti_per_fila ?? 10)
    setGruppiFile(imp.gruppi_file || [])
  }, [imp])

  const addGruppo = () => {
    setGruppiFile((g) => [...g, { lettere: 'A-G', nome: 'Platea' }])
  }

  const updateGruppo = (index: number, field: 'lettere' | 'nome', value: string) => {
    setGruppiFile((g) => g.map((x, i) => (i === index ? { ...x, [field]: value } : x)))
  }

  const removeGruppo = (index: number) => {
    setGruppiFile((g) => g.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err: { file?: string; posti?: string } = {}
    if (numero_file < 1 || numero_file > 50) err.file = 'Inserisci un valore tra 1 e 50'
    if (posti_per_fila < 1 || posti_per_fila > 50) err.posti = 'Inserisci un valore tra 1 e 50'
    setFieldErrors(err)
    if (Object.keys(err).length > 0) return
    onSave({ numero_file, posti_per_fila, gruppi_file })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formSection}>
      <div className={styles.field}>
        <label htmlFor="numero-file">Numero di file</label>
        <input
          id="numero-file"
          type="number"
          min={1}
          max={50}
          value={numero_file}
          onChange={(e) => { setNumeroFile(Number(e.target.value)); setFieldErrors((e2) => ({ ...e2, file: undefined })) }}
          aria-invalid={!!fieldErrors.file}
        />
        {fieldErrors.file && <p className={styles.fieldError}>{fieldErrors.file}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="posti-fila">Posti per fila</label>
        <input
          id="posti-fila"
          type="number"
          min={1}
          max={50}
          value={posti_per_fila}
          onChange={(e) => { setPostiPerFila(Number(e.target.value)); setFieldErrors((e2) => ({ ...e2, posti: undefined })) }}
          aria-invalid={!!fieldErrors.posti}
        />
        {fieldErrors.posti && <p className={styles.fieldError}>{fieldErrors.posti}</p>}
      </div>
      <div className={styles.field}>
        <label>Gruppi di file (nome per intervallo)</label>
        {gruppi_file.map((g, i) => (
          <div key={i} className={styles.gruppoRow}>
            <input
              type="text"
              placeholder="Es. A-G"
              value={g.lettere}
              onChange={(e) => updateGruppo(i, 'lettere', e.target.value)}
              className={styles.gruppoLettere}
              aria-label={`Lettere gruppo ${i + 1}`}
            />
            <input
              type="text"
              placeholder="Es. Platea"
              value={g.nome}
              onChange={(e) => updateGruppo(i, 'nome', e.target.value)}
              className={styles.gruppoNome}
              aria-label={`Nome gruppo ${i + 1}`}
            />
            <button type="button" onClick={() => removeGruppo(i)} className={styles.gruppoEliminaBtn} aria-label={`Elimina gruppo ${i + 1}`}>
              Elimina
            </button>
          </div>
        ))}
        <button type="button" onClick={addGruppo} className={styles.secondaryBtn}>
          + Aggiungi gruppo
        </button>
      </div>
      <div className={styles.buttonRow}>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving && <span className={styles.btnSpinner} aria-hidden />}
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
        <button type="button" onClick={onGeneraPosti} className={styles.dangerBtn}>
          Genera mappa teatro
        </button>
      </div>
    </form>
  )
}

function MappaPrenotazioni({
  byFila,
  sezioni,
  personColorMap,
  loading,
  onToggleFila,
  onTogglePosto,
}: {
  posti: Posto[]
  byFila: Record<string, Posto[]>
  sezioni: { nomeGruppo: string | null; file: string[] }[]
  personColorMap: Map<string, string>
  loading: boolean
  onToggleFila: (fila: string) => void
  onTogglePosto: (posto: Posto) => void
}) {
  const handleToggleFila = (fila: string) => {
    const postiInFila = byFila[fila] ?? []
    const filaBloccata = postiInFila.length > 0 && postiInFila.every((p) => p.riservato_staff)
    if (!filaBloccata && postiInFila.length > 1) {
      if (!window.confirm(`Bloccare tutta la fila ${fila} (${postiInFila.length} posti)? I posti saranno riservati allo staff.`)) return
    }
    onToggleFila(fila)
  }

  return (
    <div className={styles.formSection}>
      <p className={styles.hint}>
        Mappa con posti colorati per persona. Clicca sulla <strong>lettera della fila</strong> per bloccare/sbloccare tutta la fila. Clicca su un <strong>posto libero</strong> per bloccarlo singolarmente (riservato staff). I posti prenotati non sono modificabili.
      </p>
      {loading && (
        <div className={styles.mappaSkeletonWrap} aria-busy="true">
          <div className={styles.spinnerWrap}><span className={styles.spinner} /></div>
          <div className={styles.mappaSkeleton}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
              <div key={row} className={styles.mappaSkeletonRow}>
                <span className={styles.skeletonFilaLabel} />
                <div className={styles.mappaSkeletonSeats}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <span key={s} className={styles.skeletonSeat} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && sezioni.some((s) => s.file.length > 0) && (
        <>
          <div className={styles.legenda}>
            <span className={styles.legendaItem}><span className={styles.seatDisponibile} /> Disponibile</span>
            <span className={styles.legendaItem}><span className={styles.seatRiservato} /> Riservato staff</span>
            <span className={styles.legendaItem}><span className={styles.seatOccupato} style={{ backgroundColor: '#b91c1c' }} /> Prenotato</span>
          </div>
          <div className={styles.adminGridWrap}>
            <div className={styles.adminGrid}>
              {sezioni.map((sez, idx) => (
                <div key={sez.nomeGruppo ?? `sez-${idx}`} className={styles.adminSection}>
                  {sez.nomeGruppo != null && (
                    <h4 className={styles.sectionTitle}>{sez.nomeGruppo}</h4>
                  )}
                  {sez.file.map((fila) => {
                    const postiInFila = byFila[fila] ?? []
                    const filaBloccata = postiInFila.length > 0 && postiInFila.every((p) => p.riservato_staff)
                    return (
                      <div key={fila} className={styles.adminRow}>
                        <button
                          type="button"
                          className={filaBloccata ? `${styles.filaLabelBtn} ${styles.filaLabelBtnRiservata}` : styles.filaLabelBtn}
                          onClick={() => handleToggleFila(fila)}
                          title={filaBloccata ? `Fila ${fila} bloccata. Clicca per sbloccare tutta la fila` : `Fila ${fila} libera. Clicca per bloccare tutta la fila`}
                          aria-label={filaBloccata ? `Fila ${fila} bloccata. Clicca per sbloccare` : `Fila ${fila} libera. Clicca per bloccare`}
                        >
                          {filaBloccata && <span className={styles.filaLockIcon} aria-hidden>🔒</span>}
                          {fila}
                        </button>
                        <div className={styles.adminSeats}>
                          {byFila[fila]
                            .sort((a, b) => b.numero - a.numero)
                            .map((posto) => {
                              const occupato = posto.stato === 'occupato'
                              const isRiservato = posto.riservato_staff
                              const personKey = occupato ? `${posto.prenotazione_nome ?? ''}\0${posto.prenotazione_email ?? ''}` : ''
                              const color = occupato ? personColorMap.get(personKey) : undefined
                              return (
                                <button
                                  key={posto.id}
                                  type="button"
                                  className={
                                    occupato
                                      ? styles.seatOccupato
                                      : isRiservato
                                        ? styles.seatRiservato
                                        : styles.seatDisponibile
                                  }
                                  style={color ? { backgroundColor: color, borderColor: color } : undefined}
                                  disabled={occupato}
                                  title={
                                    occupato
                                      ? `Prenotato: ${posto.prenotazione_nome ?? ''}${posto.prenotazione_nome_allieva ? ` – Allieva: ${posto.prenotazione_nome_allieva}` : ''}`.trim()
                                      : isRiservato
                                        ? 'Clicca per liberare'
                                        : 'Clicca per bloccare'
                                  }
                                  onClick={() => !occupato && onTogglePosto(posto)}
                                >
                                  {posto.numero}
                                </button>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
