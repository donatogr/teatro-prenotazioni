import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../services/api'
import { RecuperaPrenotazione } from './RecuperaPrenotazione'

describe('RecuperaPrenotazione', () => {
  const onRecuperoSuccess = vi.fn()

  beforeEach(() => {
    onRecuperoSuccess.mockClear()
  })

  it('mostra il pulsante per aprire la sezione e al click il form telefono e codice', async () => {
    render(<RecuperaPrenotazione />)
    expect(screen.getByRole('button', { name: /Recupera con telefono e codice/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('333 1234567')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Recupera con telefono e codice/i }))
    expect(screen.getByPlaceholderText('333 1234567')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Recupera$/ })).toBeInTheDocument()
  })

  it('mostra errore se telefono vuoto', async () => {
    const user = userEvent.setup()
    render(<RecuperaPrenotazione />)
    await user.click(screen.getByRole('button', { name: /Recupera con telefono e codice/i }))
    await user.type(screen.getByPlaceholderText('123456'), '123456')
    await user.click(screen.getByRole('button', { name: /^Recupera$/ }))
    await waitFor(() => {
      expect(screen.getByText(/Inserisci il numero di telefono/i)).toBeInTheDocument()
    })
  })

  it('mostra errore se codice non valido', async () => {
    const user = userEvent.setup()
    render(<RecuperaPrenotazione />)
    await user.click(screen.getByRole('button', { name: /Recupera con telefono e codice/i }))
    await user.type(screen.getByPlaceholderText('333 1234567'), '3331234567')
    await user.type(screen.getByPlaceholderText('123456'), '123')
    await user.click(screen.getByRole('button', { name: /^Recupera$/ }))
    await waitFor(() => {
      expect(screen.getByText(/codice prenotazione \(6 cifre\)/i)).toBeInTheDocument()
    })
  })

  it('chiama recuperaPrenotazioni e onRecuperoSuccess al submit con dati validi', async () => {
    const user = userEvent.setup({ delay: null })
    vi.spyOn(api, 'recuperaPrenotazioni').mockResolvedValue({
      prenotazioni: [
        {
          id: 1,
          posto_id: 10,
          nome: 'Mario',
          nome_allieva: 'Luigi',
          telefono: '3331234567',
          timestamp: '2025-01-01T12:00:00',
          stato: 'confermata',
          posto_fila: 'A',
          posto_numero: 1,
        },
      ],
    })

    render(<RecuperaPrenotazione onRecuperoSuccess={onRecuperoSuccess} />)
    await user.click(screen.getByRole('button', { name: /Recupera con telefono e codice/i }))
    await user.type(screen.getByPlaceholderText('333 1234567'), '3331234567')
    await user.type(screen.getByPlaceholderText('123456'), '123456')
    await user.click(screen.getByRole('button', { name: /^Recupera$/ }))

    await waitFor(() => {
      expect(api.recuperaPrenotazioni).toHaveBeenCalledWith('3331234567', '123456')
    })
    await waitFor(() => {
      expect(onRecuperoSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Mario',
          telefono: '3331234567',
          nomeAllieva: 'Luigi',
          codice: '123456',
          prenotazioni: expect.arrayContaining([
            expect.objectContaining({ id: 1, posto_id: 10, nome: 'Mario', telefono: '3331234567' }),
          ]),
        })
      )
    })
  })

  it('mostra messaggio di errore se l\'API fallisce', async () => {
    const user = userEvent.setup({ delay: null })
    vi.spyOn(api, 'recuperaPrenotazioni').mockRejectedValue(new Error('Nessuna prenotazione trovata'))

    render(<RecuperaPrenotazione />)
    await user.click(screen.getByRole('button', { name: /Recupera con telefono e codice/i }))
    await user.type(screen.getByPlaceholderText('333 1234567'), '3331234567')
    await user.type(screen.getByPlaceholderText('123456'), '999999')
    await user.click(screen.getByRole('button', { name: /^Recupera$/ }))

    await waitFor(() => {
      expect(screen.getByText(/Nessuna prenotazione trovata|Errore recupero/i)).toBeInTheDocument()
    })
  })
})
