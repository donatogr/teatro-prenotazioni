import type { PostoStato } from '../types'
import styles from './Seat.module.css'

interface SeatProps {
  id: number
  fila: string
  numero: number
  stato: PostoStato
  onClick: () => void
  /** Colore per posti occupati (stesso colore = stessa persona) */
  personColor?: string
  /** Tooltip per posto occupato (nome prenotatario) */
  tooltipText?: string
}

const stateClass: Record<PostoStato, string> = {
  disponibile: styles.disponibile,
  occupato: styles.occupato,
  non_disponibile: styles.nonDisponibile,
  selezionato: styles.selezionato,
  bloccato: styles.bloccatoAltri,
  bloccato_da_me: styles.selezionato,
}

const statoLabelIt: Record<PostoStato, string> = {
  disponibile: 'disponibile',
  occupato: 'prenotato',
  non_disponibile: 'non disponibile',
  selezionato: 'selezionato',
  bloccato: 'prenotato',
  bloccato_da_me: 'selezionato',
}

export function Seat({ fila, numero, stato, onClick, personColor, tooltipText }: SeatProps) {
  const clickable =
    stato === 'disponibile' || stato === 'selezionato' || stato === 'bloccato_da_me'
  const label = `${fila}${numero}`
  const title =
    tooltipText != null
      ? tooltipText
      : stato === 'disponibile'
        ? 'Clicca per selezionare'
        : stato === 'selezionato' || stato === 'bloccato_da_me'
          ? 'Clicca per deselezionare'
          : stato === 'occupato'
            ? 'Prenotato'
            : stato === 'bloccato'
              ? 'Prenotato'
              : 'Non disponibile'

  return (
    <button
      type="button"
      className={`${styles.seat} ${stateClass[stato] ?? styles.nonDisponibile}`}
      style={stato === 'occupato' && personColor ? { backgroundColor: personColor, borderColor: personColor } : undefined}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={title}
      aria-label={`Posto ${label}, ${statoLabelIt[stato] ?? stato}`}
    >
      {numero}
    </button>
  )
}
