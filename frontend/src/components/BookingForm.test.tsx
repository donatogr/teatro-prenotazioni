import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('mostra il form con nome, email e pulsante', () => {
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    expect(screen.getByPlaceholderText(/nome e cognome/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conferma prenotazione/i })).toBeInTheDocument()
  })

  it('chiama onError se nome vuoto', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByLabelText(/email/i), 'test@test.it')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith('Inserisci il nome')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('chiama onError se email vuota', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith("Inserisci l'email")
  })

  it('chiama onError se email non valida', async () => {
    const user = userEvent.setup()
    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await user.type(screen.getByLabelText(/email/i), 'non-email')
    await user.click(screen.getByRole('button', { name: /conferma/i }))
    expect(onError).toHaveBeenCalledWith('Email non valida')
  })

  it('chiama onError se nessun posto selezionato', async () => {
    render(
      <BookingForm posti={[]} selectedIds={[]} onSuccess={onSuccess} onError={onError} />
    )
    await userEvent.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario')
    await userEvent.type(screen.getByLabelText(/email/i), 'mario@test.it')
    const btn = screen.getByRole('button', { name: /conferma/i })
    expect(btn).toBeDisabled()
  })

  it('chiama creaPrenotazione e onSuccess al submit con dati validi', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'creaPrenotazione').mockResolvedValue({
      prenotazioni: [],
      codice: '123456',
      codice_nuovo: true,
    })

    render(
      <BookingForm posti={[{ id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' }]} selectedIds={[1]} onSuccess={onSuccess} onError={onError} />
    )
    await user.type(screen.getByPlaceholderText(/nome e cognome/i), 'Mario Rossi')
    await user.type(screen.getByLabelText(/email/i), 'mario@test.it')

    const form = screen.getByRole('button', { name: /conferma/i }).closest('form')!
    form.requestSubmit()

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('123456', true)
    })
    expect(api.creaPrenotazione).toHaveBeenCalledWith(
      [1],
      'Mario Rossi',
      '',
      'mario@test.it',
      ''
    )
  })
})
