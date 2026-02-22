import { test, expect } from '@playwright/test'

test.describe('Validazione form', () => {
  test('con posti selezionati, submit senza nome mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.getByLabel('Email').fill('test@test.it')
    await page.getByRole('button', { name: /Conferma prenotazione/i }).click()

    await expect(page.getByText(/Inserisci il nome/i)).toBeVisible({ timeout: 5000 })
  })

  test('con posti selezionati, submit senza email mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.getByLabel('Nome').fill('Mario Rossi')
    await page.getByRole('button', { name: /Conferma prenotazione/i }).click()

    await expect(page.getByText(/Inserisci l'email/i)).toBeVisible({ timeout: 5000 })
  })

  test('con posti selezionati, email non valida mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.getByLabel('Nome').fill('Mario Rossi')
    await page.getByLabel('Email').fill('non-email')
    await page.getByRole('button', { name: /Conferma prenotazione/i }).click()

    await expect(page.getByText(/Email non valida/i)).toBeVisible({ timeout: 5000 })
  })

  test('senza posti selezionati il pulsante Conferma è disabilitato', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const btn = page.getByRole('button', { name: /Conferma prenotazione/i })
    await expect(btn).toBeDisabled()
  })

  test('Pulisci selezione rimuove i posti selezionati', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await expect(page.getByRole('button', { name: /Pulisci selezione/i })).toBeVisible({
      timeout: 5000,
    })
    await page.getByRole('button', { name: /Pulisci selezione/i }).click()

    await expect(page.getByRole('button', { name: /Pulisci selezione/i })).not.toBeVisible({
      timeout: 3000,
    })
  })
})
