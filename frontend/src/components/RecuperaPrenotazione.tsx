import { useState } from 'react'
import { recuperaPrenotazioni } from '../services/api'
import type { PrenotazioneConPosto } from '../types'
import type { RecuperoData } from './BookingForm'
import styles from './RecuperaPrenotazione.module.css'

const RECUPERA_TITLE_ID = 'recupera-prenotazione-title'

function normalizzaTelefono(val: string): string {
  return (val || '').replace(/\D/g, '')
}

function validaTelefono(val: string): string | null {
  const t = normalizzaTelefono(val)
  if (!t) return 'Inserisci il numero di telefono'
  if (t.length < 9 || t.length > 11) return 'Il numero deve avere da 9 a 11 cifre (senza prefisso)'
  return null
}

interface RecuperaPrenotazioneProps {
  onRecuperoSuccess?: (data: RecuperoData) => void
}

export function RecuperaPrenotazione({ onRecuperoSuccess }: RecuperaPrenotazioneProps) {
  const [open, setOpen] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [codice, setCodice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneConPosto[] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errTel = validaTelefono(telefono)
    const cVal = codice.trim()
    if (errTel) {
      setError(errTel)
      return
    }
    if (!cVal || cVal.length !== 6 || !/^\d+$/.test(cVal)) {
      setError('Inserisci il codice prenotazione (6 cifre)')
      return
    }
    setLoading(true)
    setError('')
    setPrenotazioni(null)
    const telNorm = normalizzaTelefono(telefono)
    try {
      const res = await recuperaPrenotazioni(telNorm, cVal)
      setPrenotazioni(res.prenotazioni)
      if (res.prenotazioni.length > 0 && onRecuperoSuccess) {
        const first = res.prenotazioni[0]
        onRecuperoSuccess({
          prenotazioni: res.prenotazioni.map((p) => ({
            id: p.id,
            posto_id: p.posto_id,
            nome: p.nome,
            nome_allieva: p.nome_allieva,
            telefono: p.telefono,
          })),
          nome: first.nome,
          telefono: telNorm,
          nomeAllieva: first.nome_allieva || '',
          codice: cVal,
        })
      }
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
      <button
        type="button"
        id={RECUPERA_TITLE_ID}
        className={styles.titleBtn}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Hai già prenotato? Recupera con telefono e codice
      </button>
      {open && (
        <div className={styles.content} role="region" aria-labelledby={RECUPERA_TITLE_ID}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <p className={styles.hint}>Inserisci telefono e codice ricevuto alla prima prenotazione.</p>
          <div className={styles.field}>
            <label htmlFor="recupera-telefono">Telefono</label>
            <input
              id="recupera-telefono"
              type="tel"
              inputMode="numeric"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
              placeholder="333 1234567"
              disabled={loading}
              maxLength={11}
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
              <div className={styles.cardList}>
                {prenotazioni.map((p) => (
                  <article key={p.id} className={styles.card}>
                    <div className={styles.cardPosto}>{p.posto_fila}{p.posto_numero}</div>
                    <div className={styles.cardDetail}>
                      {p.nome}
                      {p.nome_allieva && ` – Allieva: ${p.nome_allieva}`}
                      {' – '}{formatData(p.timestamp)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </div>
  )
}
