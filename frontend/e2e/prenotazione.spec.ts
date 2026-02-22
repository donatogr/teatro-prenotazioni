import { test, expect } from '@playwright/test'

test.describe('Flusso prenotazione', () => {
  test('caricamento pagina mostra titolo e legenda', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato|Selezionato/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Prenotazione posti|teatro|spettacolo/i)).toBeVisible({ timeout: 5000 })
  })

  test('selezione posto, compilazione form e conferma mostrano successo e codice', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await expect(page.getByText(/riservati per 5 minuti|posti selezionati/i)).toBeVisible({
      timeout: 5000,
    })

    await page.getByLabel('Nome').fill('Mario Rossi')
    await page.getByLabel('Nome allieva').fill('Giulia')
    await page.getByLabel('Email').fill('mario.e2e@test.it')

    await page.getByRole('button', { name: /Conferma prenotazione/i }).click()

    await expect(page.getByText(/Prenotazione confermata/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Copia codice/i })).toBeVisible({ timeout: 5000 })
  })
})
