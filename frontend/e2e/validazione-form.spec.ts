import { test, expect } from '@playwright/test'

test.describe('Validazione form', () => {
  test('con posti selezionati, submit senza nome mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.locator('#telefono').fill('3331234567')
    await page.getByRole('button', { name: /^Conferma$/i }).click()

    await expect(page.getByText(/Inserisci il nome/i)).toBeVisible({ timeout: 5000 })
  })

  test('con posti selezionati, submit senza telefono mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.locator('#nome').fill('Mario Rossi')
    await page.getByRole('button', { name: /^Conferma$/i }).click()

    await expect(page.getByText(/Inserisci il numero di telefono/i)).toBeVisible({ timeout: 5000 })
  })

  test('con posti selezionati, telefono non valido mostra errore', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    await page.locator('#nome').fill('Mario Rossi')
    await page.locator('#telefono').fill('123')
    await page.getByRole('button', { name: /^Conferma$/i }).click()

    await expect(page.getByText(/9 a 11 cifre|telefono/i)).toBeVisible({ timeout: 5000 })
  })

  test('senza posti selezionati il pulsante Conferma è disabilitato', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const btn = page.getByRole('button', { name: /^Conferma$/i })
    await expect(btn).toBeDisabled()
  })

  test('Pulisci selezione rimuove i posti selezionati', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

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
