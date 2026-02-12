import { useState } from 'react'
import { recuperaPrenotazioni } from '../services/api'
import type { PrenotazioneConPosto } from '../types'
import styles from './RecuperaPrenotazione.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RecuperaPrenotazione() {
  const [email, setEmail] = useState('')
  const [codice, setCodice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneConPosto[] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const eVal = email.trim()
    const cVal = codice.trim()
    if (!eVal) {
      setError('Inserisci l\'email')
      return
    }
    if (!EMAIL_RE.test(eVal)) {
      setError('Email non valida')
      return
    }
    if (!cVal || cVal.length !== 6 || !/^\d+$/.test(cVal)) {
      setError('Inserisci il codice prenotazione (6 cifre)')
      return
    }
    setLoading(true)
    setError('')
    setPrenotazioni(null)
    try {
      const res = await recuperaPrenotazioni(eVal, cVal)
      setPrenotazioni(res.prenotazioni)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore recupero prenotazione')
    } finally {
      setLoading(false)
    }
  }

  const formatData = (iso: string | null) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Recupera la tua prenotazione</h3>
      <div className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <p className={styles.hint}>Inserisci email e codice ricevuto alla prima prenotazione.</p>
          <div className={styles.field}>
            <label htmlFor="recupera-email">Email</label>
            <input
              id="recupera-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@esempio.it"
              disabled={loading}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="recupera-codice">Codice prenotazione</label>
            <input
              id="recupera-codice"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codice}
              onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              disabled={loading}
            />
          </div>
          {error && <p className={styles.err}>{error}</p>}
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Ricerca...' : 'Recupera'}
          </button>
        </form>
        {prenotazioni !== null && (
          <div className={styles.result}>
            <h4 className={styles.resultTitle}>Le tue prenotazioni</h4>
            {prenotazioni.length === 0 ? (
              <p className={styles.noPren}>Nessuna prenotazione attiva.</p>
            ) : (
              <ul className={styles.list}>
                {prenotazioni.map((p) => (
                  <li key={p.id} className={styles.item}>
                    <span className={styles.posto}>{p.posto_fila}{p.posto_numero}</span>
                    <span className={styles.detail}>{p.nome} – {formatData(p.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
