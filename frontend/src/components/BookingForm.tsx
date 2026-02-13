import { useState, useMemo } from 'react'
import { creaPrenotazione } from '../services/api'
import type { Posto } from '../types'
import styles from './BookingForm.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface BookingFormProps {
  posti: Posto[]
  selectedIds: number[]
  onSuccess: (codice?: string, codiceNuovo?: boolean) => void
  onError: (msg: string) => void
  disabled?: boolean
  sessionId?: string
}

export function BookingForm({
  posti,
  selectedIds,
  onSuccess,
  onError,
  disabled,
  sessionId = '',
}: BookingFormProps) {
  const selectedList = useMemo(() => {
    const byId = new Map(posti.map((p) => [p.id, p]))
    return selectedIds
      .map((id) => byId.get(id))
      .filter((p): p is Posto => p != null)
      .sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero)
      .map((p) => `${p.fila}${p.numero}`)
      .join(', ')
  }, [posti, selectedIds])
  const [nome, setNome] = useState('')
  const [nomeAllieva, setNomeAllieva] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = nome.trim()
    const eVal = email.trim()
    if (!n) {
      onError('Inserisci il nome')
      return
    }
    if (!eVal) {
      onError('Inserisci l\'email')
      return
    }
    if (!EMAIL_RE.test(eVal)) {
      onError('Email non valida')
      return
    }
    if (selectedIds.length === 0) {
      onError('Seleziona almeno un posto')
      return
    }
    setLoading(true)
    onError('')
    try {
      const res = await creaPrenotazione(selectedIds, n, nomeAllievaVal, eVal, sessionId)
      setNome('')
      setNomeAllieva('')
      setEmail('')
      onSuccess(res.codice, res.codice_nuovo)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Errore prenotazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.title}>Completa la prenotazione</h3>
      <div className={styles.field}>
        <label htmlFor="nome">Nome</label>
        <input
          id="nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome e cognome"
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="nome-allieva">Nome allieva</label>
        <input
          id="nome-allieva"
          type="text"
          value={nomeAllieva}
          onChange={(e) => setNomeAllieva(e.target.value)}
          placeholder="Nome dell'allieva per cui prenoti"
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@esempio.it"
          disabled={disabled}
        />
      </div>
      <p className={styles.hint}>
        Posti selezionati: {selectedIds.length}
        {selectedList && ` – ${selectedList}`}
      </p>
      {selectedIds.length > 0 && (nome.trim() || nomeAllieva.trim() || email.trim()) && (
        <p className={styles.riepilogo}>
          Stai prenotando: <strong>{selectedList}</strong>
          {nome.trim() && (
            <> per <strong>{nome.trim()}</strong></>
          )}
          {nomeAllieva.trim() && (
            <> – allieva: <strong>{nomeAllieva.trim()}</strong></>
          )}
          {email.trim() && (
            <> ({email.trim()})</>
          )}
          .
        </p>
      )}
      <button
        type="submit"
        className={styles.submit}
        disabled={disabled || loading || selectedIds.length === 0}
      >
        {loading && <span className={styles.spinner} aria-hidden />}
        {loading ? 'Prenotazione in corso...' : 'Conferma prenotazione'}
      </button>
    </form>
  )
}
