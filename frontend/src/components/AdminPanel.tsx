import { useState, useCallback, useEffect, useMemo } from 'react'
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

const PERSON_COLORS = [
  '#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0284c7', '#16a34a', '#ca8a04', '#9333ea',
]

type Tab = 'spettacolo' | 'teatro' | 'mappa' | 'blocca'

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

  const loadPosti = useCallback(() => {
    if (!password) return
    setLoading(true)
    getAdminPosti(password)
      .then(setPosti)
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore'))
      .finally(() => setLoading(false))
  }, [password])

  const loadImpostazioni = useCallback(() => {
    if (!password) return
    getImpostazioni(password)
      .then(setImpostazioniState)
      .catch(() => setImpostazioniState(null))
  }, [password])

  const loadExport = useCallback(() => {
    if (!password) return
    getExportData(password).then(setExportData).catch(() => setExportData(null))
  }, [password])

  const checkAuth = useCallback(() => {
    if (!password) return
    setError('')
    getFile(password)
      .then(() => {
        setAuthenticated(true)
        loadImpostazioni()
        loadPosti()
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Non autorizzato'))
  }, [password, loadImpostazioni, loadPosti])

  useEffect(() => {
    if (!authenticated) return
    if (tab === 'spettacolo') loadImpostazioni()
    if (tab === 'teatro') loadImpostazioni()
    if (tab === 'mappa') {
      loadPosti()
      loadExport()
    }
    if (tab === 'blocca') loadPosti()
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

  const toggleFila = async (fila: string) => {
    const postiInFila = posti.filter((p) => p.fila === fila)
    const next = !postiInFila.some((p) => p.riservato_staff)
    setError('')
    try {
      await setFilaRiservata(fila, next, password)
      loadPosti()
      onFileChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
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
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  const saveSpettacolo = async (form: Partial<Impostazioni>) => {
    setSaving(true)
    setError('')
    try {
      await putImpostazioni(password, form)
      setSuccess('Salvato')
      loadImpostazioni()
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  const saveTeatro = async (form: Partial<Impostazioni>) => {
    setSaving(true)
    setError('')
    try {
      await putImpostazioni(password, form)
      setSuccess('Salvato')
      loadImpostazioni()
      setTimeout(() => setSuccess(''), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  const handleGeneraPosti = async () => {
    if (!window.confirm('Generare la mappa teatro? I posti esistenti saranno sostituiti (solo se non ci sono prenotazioni).')) return
    setError('')
    try {
      const r = await generaPosti(password)
      setSuccess(`Creati ${r.creati} posti`)
      loadPosti()
      loadImpostazioni()
      onFileChange?.()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
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
  }

  if (!authenticated) {
    return (
      <div className={styles.overlay}>
        <div className={styles.panel}>
          <h2>Admin</h2>
          <div className={styles.field}>
            <label>Password admin</label>
            <div className={styles.fieldRow}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
                placeholder="Password"
              />
              <button type="button" onClick={checkAuth} className={styles.accediBtn}>
                Accedi
              </button>
            </div>
          </div>
          {error && <p className={styles.error}>{error}</p>}
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
    { id: 'blocca', label: 'Blocca posti' },
  ]

  return (
    <div className={styles.overlay}>
      <div className={styles.panelAdmin}>
        <h2>Pannello admin</h2>
        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

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
            exportData={exportData}
            loading={loading}
            onLoadExport={loadExport}
            onExportPdf={exportPdf}
            onStampaLista={stampaLista}
          />
        )}

        {tab === 'blocca' && (
          <BloccaPosti
            posti={posti}
            byFila={byFila}
            sezioni={sezioniAdmin}
            loading={loading}
            onToggleFila={toggleFila}
            onTogglePosto={togglePosto}
          />
        )}

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Chiudi
        </button>
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

  useEffect(() => {
    setNomeTeatro(imp.nome_teatro)
    setIndirizzoTeatro(imp.indirizzo_teatro)
    setNomeSpettacolo(imp.nome_spettacolo)
    setDataOra(imp.data_ora_evento ? imp.data_ora_evento.slice(0, 16) : '')
  }, [imp])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
        <label>Nome teatro</label>
        <input
          type="text"
          value={nome_teatro}
          onChange={(e) => setNomeTeatro(e.target.value)}
          placeholder="Es. Teatro Trivulzio"
        />
      </div>
      <div className={styles.field}>
        <label>Indirizzo teatro</label>
        <input
          type="text"
          value={indirizzo_teatro}
          onChange={(e) => setIndirizzoTeatro(e.target.value)}
          placeholder="Indirizzo completo"
        />
      </div>
      <div className={styles.field}>
        <label>Nome spettacolo</label>
        <input
          type="text"
          value={nome_spettacolo}
          onChange={(e) => setNomeSpettacolo(e.target.value)}
          placeholder="Titolo dell'evento"
        />
      </div>
      <div className={styles.field}>
        <label>Data e ora evento</label>
        <input
          type="datetime-local"
          value={dataOra}
          onChange={(e) => setDataOra(e.target.value)}
        />
      </div>
      <button type="submit" className={styles.primaryBtn} disabled={saving}>
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
    onSave({ numero_file, posti_per_fila, gruppi_file })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formSection}>
      <div className={styles.field}>
        <label>Numero di file</label>
        <input
          type="number"
          min={1}
          max={50}
          value={numero_file}
          onChange={(e) => setNumeroFile(Number(e.target.value))}
        />
      </div>
      <div className={styles.field}>
        <label>Posti per fila</label>
        <input
          type="number"
          min={1}
          max={50}
          value={posti_per_fila}
          onChange={(e) => setPostiPerFila(Number(e.target.value))}
        />
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
            />
            <input
              type="text"
              placeholder="Es. Platea"
              value={g.nome}
              onChange={(e) => updateGruppo(i, 'nome', e.target.value)}
              className={styles.gruppoNome}
            />
            <button type="button" onClick={() => removeGruppo(i)} className={styles.smallBtn}>
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
  posti,
  byFila,
  sezioni,
  personColorMap,
  exportData,
  loading,
  onLoadExport,
  onExportPdf,
  onStampaLista,
}: {
  posti: Posto[]
  byFila: Record<string, Posto[]>
  sezioni: { nomeGruppo: string | null; file: string[] }[]
  personColorMap: Map<string, string>
  exportData: { bySeat: ExportBySeat[]; byPerson: ExportByPerson[] } | null
  loading: boolean
  onLoadExport: () => void
  onExportPdf: () => void
  onStampaLista: () => void
}) {
  return (
    <div className={styles.formSection}>
      <p className={styles.hint}>
        Mappa con posti colorati per persona. Lista prenotazioni sotto.
      </p>
      {loading && <p>Caricamento...</p>}
      {!loading && sezioni.some((s) => s.file.length > 0) && (
        <div className={styles.adminGridWrap}>
          <div className={styles.adminGrid}>
            {sezioni.map((sez, idx) => (
              <div key={sez.nomeGruppo ?? `sez-${idx}`} className={styles.adminSection}>
                {sez.nomeGruppo != null && (
                  <h4 className={styles.sectionTitle}>{sez.nomeGruppo}</h4>
                )}
                {sez.file.map((fila) => (
                  <div key={fila} className={styles.adminRow}>
                    <span className={styles.filaLabel}>{fila}</span>
                    <div className={styles.adminSeats}>
                      {byFila[fila]
                        .sort((a, b) => b.numero - a.numero)
                        .map((posto) => {
                          const occupato = posto.stato === 'occupato'
                          const personKey =
                            occupato
                              ? `${posto.prenotazione_nome ?? ''}\0${posto.prenotazione_email ?? ''}`
                              : ''
                          const color = occupato ? personColorMap.get(personKey) : undefined
                          return (
                            <span
                              key={posto.id}
                              className={
                                occupato
                                  ? styles.seatOccupato
                                  : posto.riservato_staff
                                    ? styles.seatRiservato
                                    : styles.seatDisponibile
                              }
                              style={color ? { backgroundColor: color, borderColor: color } : undefined}
                              title={
                                occupato
                                  ? `Prenotato: ${posto.prenotazione_nome ?? ''}${posto.prenotazione_nome_allieva ? ` – Allieva: ${posto.prenotazione_nome_allieva}` : ''} ${posto.prenotazione_email ?? ''}`.trim()
                                  : posto.riservato_staff
                                    ? 'Riservato staff'
                                    : 'Disponibile'
                              }
                            >
                              {posto.numero}
                            </span>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={styles.exportSection}>
        <button type="button" className={styles.exportLoadBtn} onClick={onLoadExport}>
          Aggiorna lista prenotazioni
        </button>
        {exportData && (
          <>
            <h3>Per persona</h3>
            <table className={styles.exportTable}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Allieva</th>
                  <th>Email</th>
                  <th>N. posti</th>
                  <th>Posti</th>
                </tr>
              </thead>
              <tbody>
                {exportData.byPerson.map((r, i) => (
                  <tr key={i}>
                    <td>{r.nome}</td>
                    <td>{r.nome_allieva ?? ''}</td>
                    <td>{r.email}</td>
                    <td>{r.count}</td>
                    <td>{r.posti.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.pdfBtn} onClick={onExportPdf}>
                Esporta PDF
              </button>
              <button type="button" className={styles.printBtn} onClick={onStampaLista}>
                Stampa lista
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BloccaPosti({
  posti,
  byFila,
  sezioni,
  loading,
  onToggleFila,
  onTogglePosto,
}: {
  posti: Posto[]
  byFila: Record<string, Posto[]>
  sezioni: { nomeGruppo: string | null; file: string[] }[]
  loading: boolean
  onToggleFila: (fila: string) => void
  onTogglePosto: (posto: Posto) => void
}) {
  return (
    <div className={styles.formSection}>
      <p className={styles.hint}>
        Clicca sulla <strong>lettera della fila</strong> per bloccare/sbloccare tutta la fila. Clicca su un <strong>posto libero</strong> per bloccarlo singolarmente (riservato staff). I posti prenotati non sono modificabili.
      </p>
      {loading && <p>Caricamento...</p>}
      {!loading && sezioni.some((s) => s.file.length > 0) && (
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
                        onClick={() => onToggleFila(fila)}
                        title={filaBloccata ? `Fila ${fila} bloccata. Clicca per sbloccare tutta la fila` : `Fila ${fila} libera. Clicca per bloccare tutta la fila`}
                      >
                        {fila}
                      </button>
                      <div className={styles.adminSeats}>
                        {byFila[fila]
                          .sort((a, b) => b.numero - a.numero)
                          .map((posto) => {
                            const occupato = posto.stato === 'occupato'
                            const isRiservato = posto.riservato_staff
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
      )}
    </div>
  )
}
