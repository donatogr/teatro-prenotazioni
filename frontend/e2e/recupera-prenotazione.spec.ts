import { test, expect } from '@playwright/test'

test.describe('Recupera prenotazione', () => {
  test('dopo una prenotazione è possibile recuperarla con telefono e codice', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    const telefono = '3339876543'
    await page.locator('#nome').fill('Utente Recupero')
    await page.locator('#telefono').fill(telefono)
    await page.getByRole('button', { name: /^Conferma$/i }).click()
    await expect(page.getByRole('dialog').getByText(/Riepilogo prenotazione/i)).toBeVisible({
      timeout: 5000,
    })
    await page.getByRole('button', { name: /Procedi/i }).click()

    await expect(page.getByText(/Grazie per aver prenotato/i)).toBeVisible({ timeout: 10000 })
    const codiceEl = page.locator('dt:has-text("Codice prenotazione") + dd')
    await expect(codiceEl).toBeVisible({ timeout: 5000 })
    const codice = await codiceEl.textContent()
    expect(codice).toBeTruthy()
    expect(codice!.trim().length).toBe(6)

    await page.getByRole('button', { name: /Hai già prenotato\? Recupera con telefono e codice/i }).click()
    await expect(page.locator('#recupera-telefono')).toBeVisible({ timeout: 3000 })

    await page.locator('#recupera-telefono').fill(telefono)
    await page.locator('#recupera-codice').fill(codice!.trim())
    await page.getByRole('button', { name: /^Recupera$/ }).click()

    await expect(page.getByText(/Le tue prenotazioni/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Utente Recupero/)).toBeVisible({ timeout: 3000 })
  })
})
