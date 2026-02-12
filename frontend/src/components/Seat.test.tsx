import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Seat } from './Seat'

describe('Seat', () => {
  it('mostra numero e label accessibile', () => {
    render(
      <Seat id={1} fila="A" numero={3} stato="disponibile" onClick={() => {}} />
    )
    expect(screen.getByRole('button', { name: /posto A3, disponibile/i })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('chiama onClick quando cliccato e posto è disponibile', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Seat id={1} fila="A" numero={1} stato="disponibile" onClick={onClick} />
    )
    const btn = screen.getByRole('button')
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('non chiama onClick quando posto è occupato', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Seat id={1} fila="A" numero={1} stato="occupato" onClick={onClick} />
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('è disabilitato per stato non_disponibile', () => {
    render(
      <Seat id={1} fila="A" numero={1} stato="non_disponibile" onClick={() => {}} />
    )
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
