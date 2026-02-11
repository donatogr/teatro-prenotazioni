import { useCallback } from 'react'
import type { Posto } from '../types'
import { Seat } from './Seat'
import styles from './TeatroMap.module.css'

interface TeatroMapProps {
  posti: Posto[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
}

export function TeatroMap({
  posti,
  selectedIds,
  onSelectionChange,
}: TeatroMapProps) {
  const handleSeatClick = useCallback(
    (p: Posto) => {
      if (p.stato === 'occupato' || p.stato === 'non_disponibile' || p.stato === 'bloccato') return
      if (p.stato === 'bloccato_da_me' || selectedIds.includes(p.id)) {
        onSelectionChange(selectedIds.filter((id) => id !== p.id))
      } else {
        onSelectionChange([...selectedIds, p.id])
      }
    },
    [selectedIds, onSelectionChange]
  )

  const byFila = posti.reduce<Record<string, Posto[]>>((acc, posto) => {
    if (!acc[posto.fila]) acc[posto.fila] = []
    acc[posto.fila].push(posto)
    return acc
  }, {})

  const file = Object.keys(byFila).sort()

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.piantina}
        style={{
          backgroundImage: 'url(/piantina.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className={styles.grid}>
          {file.map((fila) => (
            <div key={fila} className={styles.row}>
              <span className={styles.filaLabel}>{fila}</span>
              <div className={styles.seats}>
                {byFila[fila]
                  .sort((a, b) => a.numero - b.numero)
                  .map((posto) => {
                    const displayStato =
                      (posto.stato === 'disponibile' && selectedIds.includes(posto.id)) ||
                      posto.stato === 'bloccato_da_me'
                        ? 'selezionato'
                        : posto.stato
                    return (
                      <Seat
                        key={posto.id}
                        id={posto.id}
                        fila={posto.fila}
                        numero={posto.numero}
                        stato={displayStato}
                        onClick={() => handleSeatClick(posto)}
                      />
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        <span className={styles.legItem}><i className={styles.legDisponibile} /> Disponibile</span>
        <span className={styles.legItem}><i className={styles.legSelezionato} /> Selezionato</span>
        <span className={styles.legItem}><i className={styles.legOccupato} /> Occupato</span>
        <span className={styles.legItem}><i className={styles.legBloccato} /> Bloccato</span>
        <span className={styles.legItem}><i className={styles.legNonDisp} /> Non disponibile</span>
      </div>
    </div>
  )
}
