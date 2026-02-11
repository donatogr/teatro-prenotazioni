import { useState, useCallback } from 'react'
import { getFile, setFilaRiservata } from '../services/api'
import styles from './AdminPanel.module.css'

interface AdminPanelProps {
  onClose: () => void
  onFileChange?: () => void
}

export function AdminPanel({ onClose, onFileChange }: AdminPanelProps) {
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [riservate, setRiservate] = useState<Record<string, boolean>>({})

  const loadFile = useCallback(() => {
    if (!password) return
    setLoading(true)
    setError('')
    getFile(password)
      .then((r) => {
        setFile(r.file)
        const map: Record<string, boolean> = {}
        ;(r.riservate || []).forEach((f: string) => { map[f] = true })
        setRiservate(map)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Errore'))
      .finally(() => setLoading(false))
  }, [password])

  const toggleFila = async (fila: string) => {
    if (!password) return
    const next = !riservate[fila]
    setError('')
    try {
      await setFilaRiservata(fila, next, password)
      setRiservate((prev) => ({ ...prev, [fila]: next }))
      onFileChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h2>Admin – File riservate staff</h2>
        <div className={styles.field}>
          <label>Password admin</label>
          <div className={styles.fieldRow}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFile()}
              placeholder="Password"
            />
            <button type="button" onClick={loadFile} className={styles.accediBtn}>
              Accedi
            </button>
          </div>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {loading && <p>Caricamento...</p>}
        {file.length > 0 && (
          <div className={styles.fileList}>
            {file.map((f) => (
              <label key={f} className={styles.row}>
                <input
                  type="checkbox"
                  checked={riservate[f]}
                  onChange={() => toggleFila(f)}
                />
                <span>Fila {f} – riservata staff</span>
              </label>
            ))}
          </div>
        )}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
