import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Posto } from './types'
import { getPosti, getSpettacolo, bloccaPosti, rinnovaBlocchi, rilascioBlocchi } from './services/api'
import { TeatroMap } from './components/TeatroMap'
import { BookingForm } from './components/BookingForm'
import { AdminPanel } from './components/AdminPanel'
import styles from './App.module.css'

const POLL_INTERVAL_MS = 4000
const RINNOVO_BLOCCHI_MS = 2 * 60 * 1000 // rinnovo ogni 2 minuti

function App() {
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const [posti, setPosti] = useState<Posto[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [spettacolo, setSpettacolo] = useState<{ nome_teatro: string; nome_spettacolo: string; data_ora_evento: string | null; gruppi_file: { lettere: string; nome: string }[] }>({ nome_teatro: '', nome_spettacolo: '', data_ora_evento: null, gruppi_file: [] })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    getSpettacolo().then(setSpettacolo)
  }, [])

  const fetchPosti = useCallback(async () => {
    try {
      const data = await getPosti(sessionId)
      setPosti(data)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento posti')
    }
  }, [sessionId])

  useEffect(() => {
    fetchPosti()
    const t = setInterval(fetchPosti, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [fetchPosti])

  const handleSelectionChange = useCallback(
    async (newIds: number[]) => {
      const removed = selectedIds.filter((id) => !newIds.includes(id))
      if (removed.length > 0) {
        try {
          await rilascioBlocchi(sessionId, removed)
        } catch {
          // ignora errori rilascio
        }
      }
      if (newIds.length > 0) {
        try {
          await bloccaPosti(sessionId, newIds)
          setSelectedIds(newIds)
          setError('')
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Alcuni posti non sono più disponibili')
          fetchPosti()
        }
      } else {
        setSelectedIds(newIds)
      }
      if (newIds.length > 0) {
        rinnovaBlocchi(sessionId, newIds).catch(() => {})
      }
    },
    [sessionId, selectedIds, fetchPosti]
  )

  useEffect(() => {
    if (selectedIds.length === 0) return
    const t = setInterval(() => {
      rinnovaBlocchi(sessionId, selectedIds).catch(() => {})
    }, RINNOVO_BLOCCHI_MS)
    return () => clearInterval(t)
  }, [sessionId, selectedIds])

  const handleBookingSuccess = useCallback(() => {
    setSuccess('Prenotazione confermata. A breve riceverai una email di riepilogo.')
    setSelectedIds([])
    fetchPosti()
    setTimeout(() => setSuccess(''), 5000)
  }, [fetchPosti])

  const formatDataOra = (iso: string | null) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) +
        ' ore ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerTitles}>
          <h1 className={styles.titleMain}>
            {spettacolo.nome_teatro && <span className={styles.nomeTeatro}>{spettacolo.nome_teatro}</span>}
            {spettacolo.nome_spettacolo && <span className={styles.nomeSpettacolo}>{spettacolo.nome_spettacolo}</span>}
            {!(spettacolo.nome_teatro || spettacolo.nome_spettacolo) && 'Prenotazione posti – Teatro'}
          </h1>
          {(spettacolo.data_ora_evento || spettacolo.nome_teatro || spettacolo.nome_spettacolo) && (
            <p className={styles.dataOra}>
              {spettacolo.data_ora_evento && formatDataOra(spettacolo.data_ora_evento)}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.adminBtn}
          onClick={() => setShowAdmin(true)}
        >
          Admin
        </button>
      </header>

      {error && <div className={styles.messageError}>{error}</div>}
      {success && <div className={styles.messageSuccess}>{success}</div>}

      <main className={styles.main}>
        <div className={styles.mapColumn}>
          <TeatroMap
            posti={posti}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            gruppiFile={spettacolo.gruppi_file}
          />
        </div>
        <div className={styles.formColumn}>
          <BookingForm
            posti={posti}
            selectedIds={selectedIds}
            onSuccess={handleBookingSuccess}
            onError={setError}
            disabled={posti.length === 0}
            sessionId={sessionId}
          />
          {selectedIds.length > 0 && (
            <button
              type="button"
              className={styles.pulisciBtn}
              onClick={() => handleSelectionChange([])}
            >
              Pulisci selezione
            </button>
          )}
        </div>
      </main>

      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onFileChange={fetchPosti}
        />
      )}
    </div>
  )
}

export default App
