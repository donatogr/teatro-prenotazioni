import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../services/api'
import { BookingForm } from './BookingForm'

describe('BookingForm', () => {
  const onSuccess = vi.fn()
  const onError = vi.fn()

  beforeEach(() => {
    onSuccess.mockClear()
    onError.mockClear()
  })

  it('mostra il form con nome, telefono e pulsante', () => {
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    expect(screen.getByPlaceholderText(/nome e cognome/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/telefono/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conferma/i })).toBeInTheDocument()
  })

  it('chiama onError se nome vuoto', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByLabelText(/telefono/i), '3331234567')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith('Inserisci il nome')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('chiama onError se telefono vuoto', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith('Inserisci il numero di telefono')
  })

  it('chiama onError se telefono non valido', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await user.type(screen.getByLabelText(/telefono/i), '123')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith('Il numero deve avere da 9 a 11 cifre (senza prefisso)')
  })

  it('chiama onError se nessun posto selezionato', async () => {
    render(
      <BookingForm posti={[]} selectedIds={[]} onSuccess={onSuccess} onError={onError} />
    )
    await userEvent.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await userEvent.type(screen.getByLabelText(/telefono/i), '3331234567')
    const btn = screen.getByRole('button', { name: /conferma/i })
    expect(btn).toBeDisabled()
  })

  it('chiama creaPrenotazione e onSuccess al submit con dati validi', async () => {
    const user = userEvent.setup({ delay: null })
    vi.spyOn(api, 'creaPrenotazione').mockResolvedValue({
      prenotazioni: [],
      codice: '123456',
      codice_nuovo: true,
    })

    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    const nomeInput = screen.getByPlaceholderText(/nome e cognome/i)
    const telefonoInput = screen.getByLabelText(/telefono/i)
    await user.type(nomeInput, 'Mario Rossi')
    await user.type(telefonoInput, '3331234567')

    await waitFor(() => {
      expect((nomeInput as HTMLInputElement).value).toBe('Mario Rossi')
      expect((telefonoInput as HTMLInputElement).value).toBe('3331234567')
    })

    await user.click(screen.getByRole('button', { name: /conferma/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Riepilogo prenotazione/i)).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /procedi/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('123456', true, expect.objectContaining({
        nome: 'Mario Rossi',
        telefono: '3331234567',
        posti: 'A1',
        codice: '123456',
      }), true)
    })
    expect(api.creaPrenotazione).toHaveBeenCalledWith(
      [1],
      'Mario Rossi',
      '',
      '3331234567',
      ''
    )
  })
})
