import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Posto } from './types'
import { getPosti, bloccaPosti, rinnovaBlocchi, rilascioBlocchi } from './services/api'
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

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

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Prenotazione posti – Teatro</h1>
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
        <TeatroMap
          posti={posti}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
        <BookingForm
          selectedIds={selectedIds}
          onSuccess={handleBookingSuccess}
          onError={setError}
          disabled={posti.length === 0}
          sessionId={sessionId}
        />
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
