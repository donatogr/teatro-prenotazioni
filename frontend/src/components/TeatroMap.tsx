import { useCallback, useMemo } from 'react'
import type { Posto } from '../types'
import { Seat } from './Seat'
import styles from './TeatroMap.module.css'

export interface GruppoFile {
  lettere: string
  nome: string
}

/** Espande "A-G" in [A,B,...,G] o "A,B,C" in lista; lettere singole. */
function espandiLettere(lettere: string): string[] {
  const s = (lettere || '').trim()
  if (!s) return []
  if (s.includes('-')) {
    const [a, b] = s.split('-').map((x) => x.trim())
    if (!a || !b || a.length > 1 || b.length > 1) return []
    const start = a.charCodeAt(0)
    const end = b.charCodeAt(0)
    if (start > end) return []
    const out: string[] = []
    for (let i = start; i <= end; i++) out.push(String.fromCharCode(i))
    return out
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

const PERSON_COLORS = [
  '#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0284c7', '#16a34a', '#ca8a04', '#9333ea',
]

function hashPerson(nome: string, email: string): number {
  let h = 0
  const s = nome + '\0' + email
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return Math.abs(h)
}

function getPersonColor(nome?: string, email?: string): string | undefined {
  if (nome == null && email == null) return undefined
  const h = hashPerson(nome ?? '', email ?? '')
  return PERSON_COLORS[h % PERSON_COLORS.length]
}

interface TeatroMapProps {
  posti: Posto[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  gruppiFile?: GruppoFile[]
}

export function TeatroMap({
  posti,
  selectedIds,
  onSelectionChange,
  gruppiFile = [],
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

  const tutteLeFile = Object.keys(byFila).sort()

  /** Sezioni da mostrare: [{ nomeGruppo, file: string[] }]. Se gruppiFile vuoto, una sola sezione senza nome. */
  const sezioni = useMemo(() => {
    if (!gruppiFile.length) {
      return [{ nomeGruppo: null as string | null, file: tutteLeFile }]
    }
    const assegnate = new Set<string>()
    const result: { nomeGruppo: string | null; file: string[] }[] = []
    for (const g of gruppiFile) {
      const lettere = espandiLettere(g.lettere)
      const fileInGruppo = lettere.filter((f) => byFila[f]).sort()
      fileInGruppo.forEach((f) => assegnate.add(f))
      if (fileInGruppo.length) result.push({ nomeGruppo: g.nome || g.lettere, file: fileInGruppo })
    }
    const altre = tutteLeFile.filter((f) => !assegnate.has(f))
    if (altre.length) result.push({ nomeGruppo: 'Altri', file: altre })
    return result
  }, [gruppiFile, tutteLeFile])

  const personColorMap = useMemo(() => {
    const m = new Map<string, string>()
    posti.forEach((p) => {
      if (p.stato === 'occupato' && (p.prenotazione_nome != null || p.prenotazione_email != null)) {
        const key = `${p.prenotazione_nome ?? ''}\0${p.prenotazione_email ?? ''}`
        if (!m.has(key)) m.set(key, getPersonColor(p.prenotazione_nome, p.prenotazione_email)!)
      }
    })
    return m
  }, [posti])

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
        <div className={styles.mapContent}>
          <span className={styles.filaLabel} aria-hidden="true">&nbsp;</span>
          <div className={styles.palco}>PALCO</div>
          <div className={styles.grid}>
          {sezioni.map((sez, idx) => (
            <div key={sez.nomeGruppo ?? `sez-${idx}`} className={styles.section}>
              {sez.nomeGruppo != null && (
                <h3 className={styles.sectionTitle}>{sez.nomeGruppo}</h3>
              )}
              {sez.file.map((fila) => (
                <div key={fila} className={styles.row}>
                  <span className={styles.filaLabel}>{fila}</span>
                  <div className={styles.seats}>
                    {byFila[fila]
                      .sort((a, b) => b.numero - a.numero)
                      .map((posto) => {
                        const displayStato =
                          (posto.stato === 'disponibile' && selectedIds.includes(posto.id)) ||
                          posto.stato === 'bloccato_da_me'
                            ? 'selezionato'
                            : posto.stato
                        const personKey =
                          posto.stato === 'occupato'
                            ? `${posto.prenotazione_nome ?? ''}\0${posto.prenotazione_email ?? ''}`
                            : ''
                        return (
                          <Seat
                            key={posto.id}
                            id={posto.id}
                            fila={posto.fila}
                            numero={posto.numero}
                            stato={displayStato}
                            onClick={() => handleSeatClick(posto)}
                            personColor={personKey ? personColorMap.get(personKey) : undefined}
                          />
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          </div>
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
