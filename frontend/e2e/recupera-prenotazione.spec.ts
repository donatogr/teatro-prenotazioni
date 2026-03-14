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

  test('dopo Recupera il form mostra Modifica o annulla e i campi sono compilati, i posti in giallo', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    const telefono = '3338877665'
    await page.locator('#nome').fill('Cliente Modifica')
    await page.locator('#nome-allieva').fill('Allievo')
    await page.locator('#telefono').fill(telefono)
    await page.getByRole('button', { name: /^Conferma$/i }).click()
    await page.getByRole('button', { name: /Procedi/i }).click()

    await expect(page.getByText(/Grazie per aver prenotato/i)).toBeVisible({ timeout: 10000 })
    const codice = await page.locator('dt:has-text("Codice prenotazione") + dd').textContent()
    expect(codice?.trim().length).toBe(6)

    await page.getByRole('button', { name: /Hai già prenotato\? Recupera con telefono e codice/i }).click()
    await page.locator('#recupera-telefono').fill(telefono)
    await page.locator('#recupera-codice').fill(codice!.trim())
    await page.getByRole('button', { name: /^Recupera$/ }).click()

    await expect(page.getByText(/Le tue prenotazioni/i)).toBeVisible({ timeout: 10000 })

    await expect(page.getByText(/Modifica o annulla la prenotazione/i)).toBeVisible({ timeout: 3000 })
    await expect(page.locator('#nome')).toHaveValue('Cliente Modifica')
    await expect(page.locator('#nome-allieva')).toHaveValue('Allievo')
    await expect(page.locator('#telefono')).toHaveValue(telefono)

    await expect(page.getByRole('button', { name: /Conferma modifiche/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Annulla prenotazione/i })).toBeVisible()

    const postoSelezionato = page.getByRole('button', { name: /Posto .*, selezionato/ }).first()
    await expect(postoSelezionato).toBeVisible({ timeout: 3000 })
  })

  test('Annulla prenotazione apre il dialog di conferma e Sì annulla completa l\'annullamento', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postoDisponibile = page.getByRole('button', { name: /Posto .*, disponibile/ }).first()
    await postoDisponibile.click()

    const telefono = '3337766554'
    await page.locator('#nome').fill('Cliente Annulla')
    await page.locator('#telefono').fill(telefono)
    await page.getByRole('button', { name: /^Conferma$/i }).click()
    await page.getByRole('button', { name: /Procedi/i }).click()

    await expect(page.getByText(/Grazie per aver prenotato/i)).toBeVisible({ timeout: 10000 })
    const codice = await page.locator('dt:has-text("Codice prenotazione") + dd').textContent()
    expect(codice?.trim().length).toBe(6)

    await page.getByRole('button', { name: /Hai già prenotato\? Recupera con telefono e codice/i }).click()
    await page.locator('#recupera-telefono').fill(telefono)
    await page.locator('#recupera-codice').fill(codice!.trim())
    await page.getByRole('button', { name: /^Recupera$/ }).click()

    await expect(page.getByText(/Modifica o annulla la prenotazione/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /Annulla prenotazione/i }).click()
    await expect(page.getByRole('dialog').getByText(/Annullare la prenotazione\?/i)).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByRole('button', { name: /Sì, annulla/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /No, mantieni/i })).toBeVisible()

    await page.getByRole('button', { name: /Sì, annulla/i }).click()

    await expect(page.getByText(/Completa la prenotazione/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Annulla prenotazione/i })).not.toBeVisible()
  })

  test('dopo Recupera si possono modificare i posti e confermare con Conferma modifiche', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText(/Disponibile|Prenotato/).first()).toBeVisible({ timeout: 10000 })

    const postiDisponibili = page.getByRole('button', { name: /Posto .*, disponibile/ })
    await postiDisponibili.first().click()

    const telefono = '3336655443'
    await page.locator('#nome').fill('Cliente Aggiorna')
    await page.locator('#telefono').fill(telefono)
    await page.getByRole('button', { name: /^Conferma$/i }).click()
    await page.getByRole('button', { name: /Procedi/i }).click()

    await expect(page.getByText(/Grazie per aver prenotato/i)).toBeVisible({ timeout: 10000 })
    const codice = await page.locator('dt:has-text("Codice prenotazione") + dd').textContent()
    expect(codice?.trim().length).toBe(6)

    await page.getByRole('button', { name: /Hai già prenotato\? Recupera con telefono e codice/i }).click()
    await page.locator('#recupera-telefono').fill(telefono)
    await page.locator('#recupera-codice').fill(codice!.trim())
    await page.getByRole('button', { name: /^Recupera$/ }).click()

    await expect(page.getByText(/Modifica o annulla la prenotazione/i)).toBeVisible({ timeout: 10000 })

    const altroPosto = postiDisponibili.nth(1)
    if (await altroPosto.isVisible()) {
      await altroPosto.click()
    }

    await page.getByRole('button', { name: /Conferma modifiche/i }).click()

    await expect(page.getByText(/Prenotazione confermata/i)).toBeVisible({ timeout: 10000 })
  })
})
