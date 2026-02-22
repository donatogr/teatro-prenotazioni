import { useState, useEffect, useCallback, useRef } from 'react'
import type { Posto } from './types'
import { getPosti, getSpettacolo, bloccaPosti, rinnovaBlocchi, rilascioBlocchi } from './services/api'
import { TeatroMap } from './components/TeatroMap'
import { BookingForm } from './components/BookingForm'
import { RecuperaPrenotazione } from './components/RecuperaPrenotazione'
import { AdminPanel } from './components/AdminPanel'
import styles from './App.module.css'

const POLL_INTERVAL_MS = 4000
const RINNOVO_BLOCCHI_MS = 2 * 60 * 1000 // rinnovo ogni 2 minuti
const SESSION_STORAGE_KEY = 'teatro-prenotazioni-session-id'

function App() {
  const [sessionId] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return crypto.randomUUID()
      const s = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (s && /^[0-9a-f-]{36}$/i.test(s)) return s
    } catch {}
    return crypto.randomUUID()
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    } catch {}
  }, [sessionId])
  const [posti, setPosti] = useState<Posto[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const haPulitoSelezioneRef = useRef(false)
  const [spettacolo, setSpettacolo] = useState<{ nome_teatro: string; nome_spettacolo: string; data_ora_evento: string | null; gruppi_file: { lettere: string; nome: string }[] }>({ nome_teatro: '', nome_spettacolo: '', data_ora_evento: null, gruppi_file: [] })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [successCodice, setSuccessCodice] = useState<string | null>(null)
  const [copiedCodice, setCopiedCodice] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [hintVisto, setHintVisto] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('teatro-prenotazioni-hint-visto') === '1'
    } catch {
      return false
    }
  })

  const fetchSpettacolo = useCallback(() => {
    getSpettacolo().then(setSpettacolo)
  }, [])

  useEffect(() => {
    fetchSpettacolo()
  }, [fetchSpettacolo])

  const [refreshingMessage, setRefreshingMessage] = useState(false)
  const erroreDaFetchRef = useRef(false)

  const fetchPosti = useCallback(async () => {
    try {
      const data = await getPosti(sessionId)
      setPosti(data)
      if (erroreDaFetchRef.current) {
        setError('')
        erroreDaFetchRef.current = false
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento posti')
      erroreDaFetchRef.current = true
    }
  }, [sessionId])

  useEffect(() => {
    fetchPosti()
    const t = setInterval(fetchPosti, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [fetchPosti])

  useEffect(() => {
    if (selectedIds.length > 0) return
    const bloccatiDaMe = posti.filter((p) => p.stato === 'bloccato_da_me').map((p) => p.id)
    if (haPulitoSelezioneRef.current) {
      if (bloccatiDaMe.length === 0) haPulitoSelezioneRef.current = false
      return
    }
    if (bloccatiDaMe.length > 0) {
      setSelectedIds(bloccatiDaMe)
    }
  }, [posti, selectedIds.length])

  const handleSelectionChange = useCallback(
    async (newIds: number[]) => {
      const removed = selectedIds.filter((id) => !newIds.includes(id))
      if (newIds.length === 0) {
        const toRelease = [...selectedIds]
        haPulitoSelezioneRef.current = true
        setSelectedIds([])
        if (toRelease.length > 0) {
          rilascioBlocchi(sessionId, toRelease).then(fetchPosti).catch(() => {})
        }
        return
      }
      if (removed.length > 0) {
        try {
          await rilascioBlocchi(sessionId, removed)
        } catch {
          // ignora errori rilascio
        }
      }
      try {
        await bloccaPosti(sessionId, newIds)
        setSelectedIds(newIds)
        setError('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Alcuni posti non sono più disponibili')
        setRefreshingMessage(true)
        fetchPosti()
        setTimeout(() => setRefreshingMessage(false), 2000)
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

  useEffect(() => {
    if (selectedIds.length > 0 && !hintVisto) {
      setHintVisto(true)
      try {
        sessionStorage.setItem('teatro-prenotazioni-hint-visto', '1')
      } catch {}
    }
  }, [selectedIds.length, hintVisto])

  const handleBookingSuccess = useCallback((codice?: string, codiceNuovo?: boolean) => {
    setSelectedIds([])
    fetchPosti()
    setCopiedCodice(false)
    if (codice) {
      setSuccessMessage(codiceNuovo ? 'Prenotazione confermata.' : 'Prenotazione confermata.')
      setSuccessCodice(codice)
      setTimeout(() => {
        setSuccessMessage('')
        setSuccessCodice(null)
      }, 15000)
    } else {
      setSuccessMessage('Prenotazione confermata.')
      setSuccessCodice(null)
      setTimeout(() => setSuccessMessage(''), 5000)
    }
  }, [fetchPosti])

  const handleCopyCodice = useCallback((codice: string) => {
    navigator.clipboard.writeText(codice).then(() => {
      setCopiedCodice(true)
      setTimeout(() => setCopiedCodice(false), 2500)
    })
  }, [])

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
      {successMessage && !successCodice && (
        <div className={styles.messageSuccess}>{successMessage}</div>
      )}
      {successMessage && successCodice && (
        <div className={styles.codeBox}>
          <div className={styles.messageSuccess}>{successMessage}</div>
          <div className={styles.codeValue}>{successCodice}</div>
          <button
            type="button"
            className={copiedCodice ? styles.copyBtnCopied : styles.copyBtn}
            onClick={() => handleCopyCodice(successCodice)}
            aria-live="polite"
          >
            {copiedCodice ? 'Copiato!' : 'Copia codice'}
          </button>
          <p className={styles.codeHint}>Conservalo: ti servirà con la tua email per recuperare la prenotazione.</p>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.mapColumn}>
          <p className={styles.guidaSelezione}>
            Clicca sui posti verdi per selezionarli, poi compila il form e conferma.
          </p>
          {refreshingMessage && posti.length > 0 && (
            <p className={styles.refreshingMsg}>Aggiornamento disponibilità…</p>
          )}
          {!hintVisto && (
            <div className={styles.hintBanner} role="status">
              <span>Clicca su un posto per selezionarlo.</span>
              <button
                type="button"
                className={styles.hintBannerBtn}
                onClick={() => {
                  setHintVisto(true)
                  try {
                    sessionStorage.setItem('teatro-prenotazioni-hint-visto', '1')
                  } catch {}
                }}
                aria-label="Chiudi"
              >
                OK
              </button>
            </div>
          )}
          <TeatroMap
            posti={posti}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            gruppiFile={spettacolo.gruppi_file}
          />
        </div>
        <div className={styles.formColumn}>
          {selectedIds.length > 0 && (
            <p className={styles.notaBlocco}>
              I posti selezionati sono riservati per 5 minuti. Completa la prenotazione prima della scadenza.
            </p>
          )}
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
          <RecuperaPrenotazione />
        </div>
      </main>

      {showAdmin && (
        <AdminPanel
          onClose={() => {
            setShowAdmin(false)
            fetchSpettacolo()
          }}
          onFileChange={fetchPosti}
        />
      )}
    </div>
  )
}

export default App
