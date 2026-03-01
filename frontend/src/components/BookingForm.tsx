import { useState, useMemo, useEffect } from 'react'
import { creaPrenotazione, aggiornaPrenotazione, annullaPrenotazioneByCodice } from '../services/api'
import type { Posto } from '../types'
import styles from './BookingForm.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface RecuperoData {
  prenotazioni: { id: number; posto_id: number; nome: string; nome_allieva?: string; email: string }[]
  nome: string
  email: string
  nomeAllieva: string
  codice: string
}

interface BookingFormProps {
  posti: Posto[]
  selectedIds: number[]
  onSuccess: (codice?: string, codiceNuovo?: boolean) => void
  onError: (msg: string) => void
  disabled?: boolean
  sessionId?: string
  recuperoData?: RecuperoData | null
  onRecuperoCancel?: () => void
  onAggiornaSuccess?: (codice: string) => void
  fetchPosti?: () => void
}

export function BookingForm({
  posti,
  selectedIds,
  onSuccess,
  onError,
  disabled,
  sessionId = '',
  recuperoData = null,
  onRecuperoCancel,
  onAggiornaSuccess,
  fetchPosti,
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showAnnullaConfirm, setShowAnnullaConfirm] = useState(false)

  useEffect(() => {
    if (recuperoData) {
      setNome(recuperoData.nome)
      setEmail(recuperoData.email)
      setNomeAllieva(recuperoData.nomeAllieva || '')
    }
  }, [recuperoData])

  const handleSubmit = (e: React.FormEvent) => {
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
    onError('')
    setShowConfirmDialog(true)
  }

  const handleProcedi = async () => {
    const n = nome.trim()
    const eVal = email.trim()
    setLoading(true)
    try {
      const res = await creaPrenotazione(selectedIds, n, nomeAllieva.trim(), eVal, sessionId)
      setShowConfirmDialog(false)
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

  const handleConfermaModifiche = async () => {
    if (!recuperoData) return
    const n = nome.trim()
    const eVal = email.trim()
    if (!n || !eVal || !EMAIL_RE.test(eVal)) {
      onError('Nome e email validi richiesti')
      return
    }
    if (selectedIds.length === 0) {
      onError('Seleziona almeno un posto')
      return
    }
    setLoading(true)
    onError('')
    try {
      await aggiornaPrenotazione(recuperoData.email, recuperoData.codice, selectedIds, n, nomeAllieva.trim())
      onAggiornaSuccess?.(recuperoData.codice)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Errore aggiornamento')
    } finally {
      setLoading(false)
    }
  }

  const handleAnnullaPrenotazione = async () => {
    if (!recuperoData) return
    setLoading(true)
    onError('')
    try {
      await annullaPrenotazioneByCodice(recuperoData.email, recuperoData.codice)
      setShowAnnullaConfirm(false)
      onRecuperoCancel?.()
      fetchPosti?.()
      onSuccess()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Errore annullamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.title}>
        {recuperoData ? 'Modifica o annulla la prenotazione' : 'Completa la prenotazione'}
      </h3>
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
          disabled={disabled || !!recuperoData}
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
      {recuperoData ? (
        <>
          <button
            type="button"
            className={styles.submit}
            onClick={handleConfermaModifiche}
            disabled={disabled || loading || selectedIds.length === 0}
          >
            {loading && <span className={styles.spinner} aria-hidden />}
            {loading ? 'Salvataggio...' : 'Conferma modifiche'}
          </button>
          <button
            type="button"
            className={styles.annullaBtn}
            onClick={() => setShowAnnullaConfirm(true)}
            disabled={loading}
          >
            Annulla prenotazione
          </button>
          {showAnnullaConfirm && (
            <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="annulla-dialog-title">
              <div className={styles.dialog}>
                <h3 id="annulla-dialog-title" className={styles.dialogTitle}>Annullare la prenotazione?</h3>
                <p className={styles.dialogText}>
                  Tutti i posti prenotati saranno liberati. Riceverai un&apos;email di conferma dell&apos;annullamento.
                </p>
                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.dialogBtnSecondary}
                    onClick={() => setShowAnnullaConfirm(false)}
                    disabled={loading}
                  >
                    No, mantieni
                  </button>
                  <button
                    type="button"
                    className={styles.annullaConfirmBtn}
                    onClick={handleAnnullaPrenotazione}
                    disabled={loading}
                  >
                    {loading ? '...' : 'Sì, annulla'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="submit"
          className={styles.submit}
          disabled={disabled || loading || selectedIds.length === 0}
        >
          {loading && <span className={styles.spinner} aria-hidden />}
          {loading ? 'Prenotazione in corso...' : 'Conferma'}
        </button>
      )}

      {showConfirmDialog && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className={styles.dialog}>
            <h3 id="dialog-title" className={styles.dialogTitle}>Riepilogo prenotazione</h3>
            <dl className={styles.dialogDetails}>
              <dt>Nome e cognome</dt>
              <dd>{nome.trim()}</dd>
              <dt>Allieva</dt>
              <dd>{nomeAllieva.trim() || '—'}</dd>
              <dt>Email</dt>
              <dd>{email.trim()}</dd>
              <dt>Posti prenotati</dt>
              <dd>{selectedList || selectedIds.join(', ')}</dd>
            </dl>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogBtnSecondary}
                onClick={() => setShowConfirmDialog(false)}
                disabled={loading}
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.dialogBtnPrimary}
                onClick={handleProcedi}
                disabled={loading}
              >
                {loading && <span className={styles.spinner} aria-hidden />}
                {loading ? 'Prenotazione in corso...' : 'Procedi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
