# User journey – Prenotazione posti teatro

Descrizione dei flussi utente dell’applicazione.

---

## 1. Utente pubblico – Nuova prenotazione

1. **Ingresso**  
   Apre l’app (es. http://localhost:5173). Vede l’header (nome teatro, nome spettacolo, data/ora se configurati) e la piantina dei posti. Sopra la piantina è mostrata la guida «Clicca sui posti verdi per selezionarli, poi compila il form e conferma»; la prima volta può apparire un banner hint «Clicca su un posto per selezionarlo» (chiudibile con OK). Con almeno un posto selezionato compare il messaggio che i posti sono riservati per 5 minuti.

2. **Esplorazione**  
   La piantina si aggiorna ogni 4 secondi. I posti hanno stati visivi: **disponibile** (verde), **occupato**, **non disponibile** (riservato staff), **bloccato** (in prenotazione da altri, arancione), **bloccato_da_me** (selezionati da lui).

3. **Selezione**  
   Clicca sui posti verdi per selezionarli. I posti selezionati vengono **bloccati per 5 minuti** per la sua sessione; il blocco si rinnova ogni 2 minuti e a ogni interazione (click, digitazione nel form). Può deselezionare con un altro click o con “Pulisci selezione”.

4. **Form**  
   Con almeno un posto selezionato compila Nome, Nome allieva (opzionale), **Telefono** (senza prefisso internazionale, 9–11 cifre) e clicca “Conferma”.

5. **Dialog di riepilogo**  
   Cliccando “Conferma” viene mostrata una dialog con i dettagli della prenotazione: nome e cognome, allieva, telefono, posti prenotati. La dialog ha due tasti: **“Indietro”** (chiude la dialog senza procedere) e **“Procedi”**. Premendo “Indietro” la dialog si chiude; premendo “Procedi” si procede con la prenotazione.

6. **Conferma effettiva**  
   Dopo “Procedi” il backend crea la prenotazione, rilascia i blocchi e restituisce un **codice a 6 cifre**. L’utente viene portato **direttamente** alla **schermata di ringraziamento** (nessun box intermedio con “Nuova prenotazione” / “Ho finito”).  
   **Schermata di ringraziamento:** testo di ringraziamento e invito a contattare la scuola per il pagamento; **riepilogo della prenotazione** (nome, nome allieva se presente, telefono, posti, codice); hint per conservare il codice e usare telefono e codice nella sezione “Recupera con telefono e codice” per modifiche successive; “Ora puoi chiudere questa finestra”; pulsante **“Stampa riepilogo”** per stampare il riepilogo.  
   **Notifica admin:** se configurato, all’amministratore viene inviata un’email con i dettagli della prenotazione (nome, telefono, posti, codice); all’utente non viene inviata email.

**Possibili intoppi:** posti non più disponibili durante il flusso (messaggio di errore e invito ad aggiornare), validazione telefono/nome obbligatori (telefono: solo cifre, 9–11 caratteri).

---

## 2. Utente pubblico – Recupero prenotazione

1. **Ingresso**  
   Sempre dalla stessa pagina principale, in colonna destra sotto il form di prenotazione.

2. **Apertura**  
   Clicca su “Hai già prenotato? Recupera con telefono e codice” per aprire la sezione.

3. **Dati**  
   Inserisce **telefono** (stesso numero usato in prenotazione, senza prefisso) e **codice prenotazione** (6 cifre) ricevuti alla prima prenotazione.

4. **Recupero**  
   Clicca “Recupera”. I campi del form vengono riempiti con i dati della prenotazione; i posti già prenotati vengono nuovamente segnati in **giallo** sulla piantina. L’utente può **aggiungere ulteriori posti** alla prenotazione e/o **rimuovere** posti già prenotati, poi confermare le modifiche.

5. **Annullamento prenotazione**  
   L’utente può annullare la prenotazione con un tasto apposito. In tal caso viene chiesta **conferma**; dopo la conferma la prenotazione viene annullata. Se configurato, all’amministratore viene inviata un’email di notifica dell’annullamento (con telefono e dettagli); all’utente non viene inviata email.

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
   Export/lista prenotazioni: vista **per posto** e **per persona** (con ricerca per nome o telefono, ordinamento), utile per stampa o gestione. Può vedere numero di prenotazioni e dettagli (nome, telefono, posti). Per ogni nuova prenotazione l’admin riceve inoltre l’email di conferma con dettagli spettacolo, telefono, posti, codice e istruzioni per recupero con telefono e codice.

7. **Uscita**  
   Chiude il pannello; la pagina pubblica si aggiorna (es. dati spettacolo e posti).

---

## Riepilogo

| Journey                 | Trigger                         | Obiettivo                                              |
|-------------------------|----------------------------------|--------------------------------------------------------|
| **Nuova prenotazione**  | Apertura app + selezione posti  | Bloccare posti, compilare form (telefono), confermare → pagina di ringraziamento con codice |
| **Recupero prenotazione** | “Hai già prenotato?” + telefono + codice | Recuperare prenotazione, modificare posti o annullare (notifica admin se configurata) |
| **Admin**               | Pulsante Admin + password       | Configurare spettacolo/teatro, riservare file/posti, consultare elenchi |

Tutto avviene in **un’unica pagina**: i flussi si distinguono per componenti visibili (TeatroMap + BookingForm, RecuperaPrenotazione espandibile, AdminPanel modale) e per le chiamate API usate.
