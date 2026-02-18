import { test, expect } from '@playwright/test'

test.describe('Recupera prenotazione', () => {
  test('dopo una prenotazione è possibile recuperarla con email e codice', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByText(/Disponibile|Prenotato/)).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    const email = 'recupero.e2e@test.it'
    await page.getByLabel('Nome').fill('Utente Recupero')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: /Conferma prenotazione/i }).click()

    await expect(page.getByText(/Prenotazione confermata/i)).toBeVisible({ timeout: 10000 })
    const codeBox = page.locator('[class*="codeValue"]').first()
    await expect(codeBox).toBeVisible({ timeout: 5000 })
    const codice = await codeBox.textContent()
    expect(codice).toBeTruthy()
    expect(codice!.trim().length).toBe(6)

    await page.getByRole('button', { name: /Hai già prenotato\? Recupera con email e codice/i }).click()
    await expect(page.locator('#recupera-email')).toBeVisible({ timeout: 3000 })

    await page.locator('#recupera-email').fill(email)
    await page.locator('#recupera-codice').fill(codice!.trim())
    await page.getByRole('button', { name: /^Recupera$/ }).click()

    await expect(page.getByText(/Le tue prenotazioni/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Utente Recupero/)).toBeVisible({ timeout: 3000 })
  })
})
