import type { PostoStato } from '../types'
import styles from './Seat.module.css'

interface SeatProps {
  id: number
  fila: string
  numero: number
  stato: PostoStato
  onClick: () => void
}

const stateClass: Record<PostoStato, string> = {
  disponibile: styles.disponibile,
  occupato: styles.occupato,
  non_disponibile: styles.nonDisponibile,
  selezionato: styles.selezionato,
  bloccato: styles.bloccatoAltri,
  bloccato_da_me: styles.selezionato,
}

export function Seat({ id, fila, numero, stato, onClick }: SeatProps) {
  const clickable =
    stato === 'disponibile' || stato === 'selezionato' || stato === 'bloccato_da_me'
  const label = `${fila}${numero}`

  return (
    <button
      type="button"
      className={`${styles.seat} ${stateClass[stato] ?? styles.nonDisponibile}`}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={
        stato === 'disponibile'
          ? 'Clicca per selezionare'
          : stato === 'selezionato' || stato === 'bloccato_da_me'
            ? 'Clicca per deselezionare'
            : stato === 'occupato'
              ? 'Occupato'
              : stato === 'bloccato'
                ? 'Bloccato da altro utente'
                : 'Non disponibile'
      }
      aria-label={`Posto ${label}, ${stato}`}
    >
      {numero}
    </button>
  )
}
