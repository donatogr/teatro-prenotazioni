import { useState, useCallback, useEffect } from 'react'
import {
  getAdminPosti,
  getFile,
  setFilaRiservata,
  setPostoRiservato,
  getExportData,
} from '../services/api'
import type { Posto, ExportBySeat, ExportByPerson } from '../types'
import styles from './AdminPanel.module.css'

interface AdminPanelProps {
  onClose: () => void
  onFileChange?: () => void
}

export function AdminPanel({ onClose, onFileChange }: AdminPanelProps) {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [posti, setPosti] = useState<Posto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'riserve' | 'export'>('riserve')
  const [exportData, setExportData] = useState<{ bySeat: ExportBySeat[]; byPerson: ExportByPerson[] } | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const loadPosti = useCallback(() => {
    if (!password) return
    setLoading(true)
    setError('')
    getAdminPosti(password)
      .then(setPosti)
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore'))
      .finally(() => setLoading(false))
  }, [password])

  const checkAuth = useCallback(() => {
    if (!password) return
    setError('')
    getFile(password)
      .then(() => {
        setAuthenticated(true)
        loadPosti()
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Non autorizzato'))
  }, [password, loadPosti])

  useEffect(() => {
    if (authenticated && tab === 'riserve') loadPosti()
  }, [authenticated, tab, loadPosti])

  const toggleFila = async (fila: string) => {
    const postiInFila = posti.filter((p) => p.fila === fila)
    const anyRiservato = postiInFila.some((p) => p.riservato_staff)
    const next = !anyRiservato
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

  const loadExport = () => {
    setExportLoading(true)
    setError('')
    getExportData(password)
      .then((data) => {
        setExportData(data)
        setTab('export')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore'))
      .finally(() => setExportLoading(false))
  }

  const exportPdf = () => {
    if (!exportData) return
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = 15
      const lineH = 6
      const colW = [25, 50, 45, 50]

      doc.setFontSize(14)
      doc.text('Elenco posti prenotati', 14, y)
      y += lineH + 4
      doc.setFontSize(10)
      if (exportData.bySeat.length === 0) {
        doc.text('Nessuna prenotazione.', 14, y)
        y += lineH + 6
      } else {
        doc.text('Posto', 14, y)
        doc.text('Nome', 14 + colW[0], y)
        doc.text('Email', 14 + colW[0] + colW[1], y)
        y += lineH
        exportData.bySeat.forEach((r) => {
          if (y > 270) {
            doc.addPage()
            y = 15
          }
          doc.text(r.posto, 14, y)
          doc.text(r.nome, 14 + colW[0], y)
          doc.text(r.email, 14 + colW[0] + colW[1], y)
          y += lineH
        })
        y += 8
      }

      doc.setFontSize(14)
      doc.text('Riepilogo per persona', 14, y)
      y += lineH + 4
      doc.setFontSize(10)
      if (exportData.byPerson.length === 0) {
        doc.text('Nessuna prenotazione.', 14, y)
      } else {
        exportData.byPerson.forEach((r) => {
          if (y > 270) {
            doc.addPage()
            y = 15
          }
          doc.text(`${r.nome} (${r.email}) – ${r.count} posto/i: ${r.posti.join(', ')}`, 14, y)
          y += lineH
        })
      }

      doc.save('prenotazioni-teatro.pdf')
    })
  }

  const byFila = posti.reduce<Record<string, Posto[]>>((acc, p) => {
    if (!acc[p.fila]) acc[p.fila] = []
    acc[p.fila].push(p)
    return acc
  }, {})
  const file = Object.keys(byFila).sort()

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

  return (
    <div className={styles.overlay}>
      <div className={styles.panelAdmin}>
        <h2>Admin – Riserve e export</h2>
        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === 'riserve' ? styles.tabActive : styles.tab}
            onClick={() => setTab('riserve')}
          >
            Riserve posti
          </button>
          <button
            type="button"
            className={tab === 'export' ? styles.tabActive : styles.tab}
            onClick={() => setTab('export')}
          >
            Export
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}

        {tab === 'riserve' && (
          <>
            <p className={styles.hint}>
              Clicca su una <strong>fila</strong> per riservare/liberare tutta la fila. Clicca su un <strong>singolo posto</strong> (non prenotato) per riservarlo o liberarlo. Passa il mouse sui posti occupati per vedere il nome.
            </p>
            {loading && <p>Caricamento...</p>}
            {!loading && file.length > 0 && (
              <div className={styles.adminGridWrap}>
                <div className={styles.adminGrid}>
                  {file.map((fila) => (
                    <div key={fila} className={styles.adminRow}>
                      <button
                        type="button"
                        className={styles.filaLabelBtn}
                        onClick={() => toggleFila(fila)}
                        title={`Riserva/libera tutta la fila ${fila}`}
                      >
                        {fila}
                      </button>
                      <div className={styles.adminSeats}>
                        {byFila[fila]
                          .sort((a, b) => a.numero - b.numero)
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
                                    ? `Prenotato: ${posto.prenotazione_nome ?? ''} ${posto.prenotazione_email ?? ''}`.trim()
                                    : isRiservato
                                      ? 'Clicca per liberare (riservato staff)'
                                      : 'Clicca per riservare'
                                }
                                onClick={() => !occupato && togglePosto(posto)}
                              >
                                {posto.numero}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'export' && (
          <>
            <button
              type="button"
              className={styles.exportLoadBtn}
              onClick={loadExport}
              disabled={exportLoading}
            >
              {exportLoading ? 'Caricamento...' : 'Carica dati export'}
            </button>
            {exportData && (
              <>
                <div className={styles.exportSection}>
                  <h3>Posti prenotati</h3>
                  <table className={styles.exportTable}>
                    <thead>
                      <tr>
                        <th>Posto</th>
                        <th>Nome</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportData.bySeat.map((r, i) => (
                        <tr key={i}>
                          <td>{r.posto}</td>
                          <td>{r.nome}</td>
                          <td>{r.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.exportSection}>
                  <h3>Riepilogo per persona</h3>
                  <table className={styles.exportTable}>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>N. posti</th>
                        <th>Posti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportData.byPerson.map((r, i) => (
                        <tr key={i}>
                          <td>{r.nome}</td>
                          <td>{r.email}</td>
                          <td>{r.count}</td>
                          <td>{r.posti.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className={styles.pdfBtn} onClick={exportPdf}>
                  Esporta PDF
                </button>
              </>
            )}
          </>
        )}

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
