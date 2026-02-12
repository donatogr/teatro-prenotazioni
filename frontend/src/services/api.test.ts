import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from './api'

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getPosti', () => {
    it('chiama GET /api/posti e restituisce array', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([{ id: 1, fila: 'A', numero: 1 }]) })
      const result = await api.getPosti()
      expect(fetchMock).toHaveBeenCalledWith('/api/posti', { headers: {} })
      expect(result).toEqual([{ id: 1, fila: 'A', numero: 1 }])
    })

    it('invia session_id in query e header se fornito', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
      await api.getPosti('sess-123')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/posti?session_id=sess-123',
        { headers: { 'X-Session-Id': 'sess-123' } }
      )
    })

    it('lancia se risposta non ok', async () => {
      fetchMock.mockResolvedValue({ ok: false })
      await expect(api.getPosti()).rejects.toThrow('Errore caricamento posti')
    })
  })

  describe('bloccaPosti', () => {
    it('chiama POST /api/blocchi con session_id e posto_ids', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true, bloccati: [1, 2] }) })
      const result = await api.bloccaPosti('sess', [1, 2])
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/blocchi',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ session_id: 'sess', posto_ids: [1, 2] }),
        })
      )
      expect(result).toEqual({ ok: true, bloccati: [1, 2] })
    })

    it('lancia su 409 con messaggio errore', async () => {
      fetchMock.mockResolvedValue({
        status: 409,
        ok: false,
        json: () => Promise.resolve({ error: 'Posti occupati' }),
      })
      await expect(api.bloccaPosti('s', [1])).rejects.toThrow('Posti occupati')
    })
  })

  describe('creaPrenotazione', () => {
    it('chiama POST /api/prenotazioni e restituisce prenotazioni', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ prenotazioni: [{ id: 1, nome: 'Mario' }] }),
      })
      const result = await api.creaPrenotazione([1], 'Mario', 'm@m.it')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/prenotazioni',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Mario'),
        })
      )
      expect(result.prenotazioni).toHaveLength(1)
    })

    it('lancia su risposta non ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Posto non disponibile' }),
      })
      await expect(api.creaPrenotazione([1], 'M', 'm@m.it')).rejects.toThrow('Posto non disponibile')
    })
  })

  describe('getFile (admin)', () => {
    it('chiama GET /api/admin/file con password e restituisce file e riservate', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ file: ['A', 'B'], riservate: ['A'] }),
      })
      const result = await api.getFile('admin123')
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/file?password=admin123')
      expect(result).toEqual({ file: ['A', 'B'], riservate: ['A'] })
    })

    it('lancia se non autorizzato', async () => {
      fetchMock.mockResolvedValue({ ok: false })
      await expect(api.getFile('wrong')).rejects.toThrow('Non autorizzato')
    })
  })
})
