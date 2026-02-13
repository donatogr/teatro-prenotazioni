import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeatroMap } from './TeatroMap'

const postiMock = [
  { id: 1, fila: 'A', numero: 1, disponibile: true, riservato_staff: false, stato: 'disponibile' as const },
  { id: 2, fila: 'A', numero: 2, disponibile: true, riservato_staff: false, stato: 'disponibile' as const },
  { id: 3, fila: 'B', numero: 1, disponibile: true, riservato_staff: false, stato: 'occupato' as const },
]

describe('TeatroMap', () => {
  it('mostra le file ordinate e la legenda', () => {
    const onSelectionChange = vi.fn()
    render(
      <TeatroMap posti={postiMock} selectedIds={[]} onSelectionChange={onSelectionChange} />
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText(/Disponibile/)).toBeInTheDocument()
    expect(screen.getByText(/Prenotato/)).toBeInTheDocument()
  })

  it('chiama onSelectionChange aggiungendo posto quando si clicca su disponibile', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(
      <TeatroMap posti={postiMock} selectedIds={[]} onSelectionChange={onSelectionChange} />
    )
    // Fila A è ordinata per numero decrescente (2 poi 1), quindi primo bottone = id 2, secondo = id 1.
    // Il test non aggiorna selectedIds tra i click, quindi al secondo click il componente ha ancora selectedIds=[] e chiama con [1].
    const buttons = screen.getAllByRole('button').filter(b => b.textContent === '1' || b.textContent === '2')
    await user.click(buttons[0]!)
    expect(onSelectionChange).toHaveBeenCalledWith([2])
    onSelectionChange.mockClear()
    await user.click(buttons[1]!)
    expect(onSelectionChange).toHaveBeenCalledWith([1])
  })

  it('rimuove posto dalla selezione quando si clicca su posto già selezionato', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(
      <TeatroMap posti={postiMock} selectedIds={[1]} onSelectionChange={onSelectionChange} />
    )
    const btn1 = screen.getAllByRole('button').find(b => b.textContent === '1')
    await user.click(btn1!)
    expect(onSelectionChange).toHaveBeenCalledWith([])
  })
})
