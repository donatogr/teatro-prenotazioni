# User journey – Prenotazione posti teatro

Descrizione dei flussi utente dell’applicazione.

---

## 1. Utente pubblico – Nuova prenotazione

1. **Ingresso**  
   Apre l’app (es. http://localhost:5173). Vede l’header (nome teatro, nome spettacolo, data/ora se configurati) e la piantina dei posti.

2. **Esplorazione**  
   La piantina si aggiorna ogni 4 secondi. I posti hanno stati visivi: **disponibile** (verde), **occupato**, **non disponibile** (riservato staff), **bloccato** (in prenotazione da altri, arancione), **bloccato_da_me** (selezionati da lui).

3. **Selezione**  
   Clicca sui posti verdi per selezionarli. I posti selezionati vengono **bloccati per 5 minuti** per la sua sessione; il blocco si rinnova ogni 2 minuti e a ogni interazione (click, digitazione nel form). Può deselezionare con un altro click o con “Pulisci selezione”.

4. **Form**  
   Con almeno un posto selezionato compila Nome, Nome allieva (opzionale), Email e clicca “Conferma”.

5. **Dialog di riepilogo**  
   Cliccando “Conferma” viene mostrata una dialog con i dettagli della prenotazione: nome e cognome, allieva, email, posti prenotati. La dialog ha due tasti: **“Indietro”** (chiude la dialog senza procedere) e **“Procedi”**. Premendo “Indietro” la dialog si chiude; premendo “Procedi” si procede con la prenotazione.

6. **Conferma effettiva**  
   Dopo “Procedi” il backend crea la prenotazione, rilascia i blocchi e restituisce un **codice a 6 cifre**. In pagina vede “Prenotazione confermata”, il codice e il pulsante “Copia codice”.  
   **Email di conferma:** all’utente e all’amministratore viene inviata un’email con i dettagli della prenotazione: dettagli dello spettacolo, posti prenotati, codice della prenotazione e istruzioni per modificare la prenotazione.

**Possibili intoppi:** posti non più disponibili durante il flusso (messaggio di errore e invito ad aggiornare), validazione email/nome obbligatori.

---

## 2. Utente pubblico – Recupero prenotazione

1. **Ingresso**  
   Sempre dalla stessa pagina principale, in colonna destra sotto il form di prenotazione.

2. **Apertura**  
   Clicca su “Hai già prenotato? Recupera con email e codice” per aprire la sezione.

3. **Dati**  
   Inserisce **email** e **codice prenotazione** (6 cifre) ricevuti alla prima prenotazione.

4. **Recupero**  
   Clicca “Recupera”. I campi del form vengono riempiti con i dati della prenotazione; i posti già prenotati vengono nuovamente segnati in **giallo** sulla piantina. L’utente può **aggiungere ulteriori posti** alla prenotazione e/o **rimuovere** posti già prenotati, poi confermare le modifiche.

5. **Annullamento prenotazione**  
   L’utente può annullare la prenotazione con un tasto apposito. In tal caso viene chiesta **conferma**; dopo la conferma la prenotazione viene annullata e viene inviata un’email sia all’utente sia all’amministratore in cui si indica l’annullamento della prenotazione.

---

## 3. Admin – Accesso e gestione

1. **Accesso**  
   Clic su **Admin** in alto a destra. Si apre un pannello modale con richiesta **password** (default `admin123`, configurabile con `ADMIN_PASSWORD`).

2. **Autenticazione**  
   Inserisce la password; il backend verifica con `getFile(password)`. Se ok, entra nel pannello con 4 tab.

3. **Tab “Spettacolo”**  
   Imposta nome teatro, nome spettacolo, data/ora evento e **gruppi di file** (es. “A–G” = Platea, “H–L” = Galleria) per etichette sulla piantina. Salva → il frontend pubblico riceve dati aggiornati (es. dopo chiusura pannello).

4. **Tab “Teatro”**  
   Gestione struttura sala (es. generazione posti). Impatto sulla piantina e sui posti disponibili.

5. **Tab “Mappa”**  
   Vede la stessa piantina ma in versione admin: posti colorati per prenotazione (rosso a tonalità diverse per persona). Può **marcare intere file** come “riservate staff” (non prenotabili) o **singoli posti** come riservati. Le modifiche si riflettono subito sulla vista pubblica (posti “non disponibili”).

6. **Tab “Elenco”**  
   Export/lista prenotazioni: vista **per posto** e **per persona** (con ricerca, ordinamento), utile per stampa o gestione. Può vedere numero di prenotazioni e dettagli. Per ogni nuova prenotazione l’admin riceve inoltre l’email di conferma con dettagli spettacolo, posti, codice e istruzioni per modificare la prenotazione.

7. **Uscita**  
   Chiude il pannello; la pagina pubblica si aggiorna (es. dati spettacolo e posti).

---

## Riepilogo

| Journey                 | Trigger                         | Obiettivo                                              |
|-------------------------|----------------------------------|--------------------------------------------------------|
| **Nuova prenotazione**  | Apertura app + selezione posti  | Bloccare posti, compilare form, ottenere codice        |
| **Recupero prenotazione** | “Hai già prenotato?” + email + codice | Recuperare prenotazione, modificare posti o annullare (con email di annullamento) |
| **Admin**               | Pulsante Admin + password       | Configurare spettacolo/teatro, riservare file/posti, consultare elenchi |

Tutto avviene in **un’unica pagina**: i flussi si distinguono per componenti visibili (TeatroMap + BookingForm, RecuperaPrenotazione espandibile, AdminPanel modale) e per le chiamate API usate.
