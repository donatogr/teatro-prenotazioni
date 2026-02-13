const API_BASE = '/api';

function sessionHeaders(sessionId: string): HeadersInit {
  return { 'X-Session-Id': sessionId };
}

export async function getSpettacolo(): Promise<{
  nome_teatro: string;
  nome_spettacolo: string;
  data_ora_evento: string | null;
  gruppi_file: { lettere: string; nome: string }[];
}> {
  const r = await fetch(`${API_BASE}/spettacolo`);
  if (!r.ok) return { nome_teatro: '', nome_spettacolo: '', data_ora_evento: null, gruppi_file: [] };
  return r.json();
}

export async function getPosti(sessionId: string = ''): Promise<import('../types').Posto[]> {
  const url = sessionId ? `${API_BASE}/posti?session_id=${encodeURIComponent(sessionId)}` : `${API_BASE}/posti`;
  const r = await fetch(url, { headers: sessionId ? sessionHeaders(sessionId) : {} });
  if (!r.ok) throw new Error('Errore caricamento posti');
  return r.json();
}

export async function bloccaPosti(
  sessionId: string,
  postoIds: number[]
): Promise<{ ok: boolean; bloccati: number[] }> {
  const r = await fetch(`${API_BASE}/blocchi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(sessionId) },
    body: JSON.stringify({ session_id: sessionId, posto_ids: postoIds }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 409) {
    const msg =
      data.conflitti_etichette?.length > 0
        ? `Posti ${data.conflitti_etichette.join(', ')} non più disponibili. Scegli altri.`
        : data.error || 'Alcuni posti non sono più disponibili';
    throw new Error(msg);
  }
  if (!r.ok) throw new Error(data.error || 'Errore blocco posti');
  return data;
}

export async function rinnovaBlocchi(sessionId: string, postoIds: number[]): Promise<void> {
  if (!sessionId || postoIds.length === 0) return;
  await fetch(`${API_BASE}/blocchi/rinnovo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(sessionId) },
    body: JSON.stringify({ session_id: sessionId, posto_ids: postoIds }),
  });
}

export async function rilascioBlocchi(sessionId: string, postoIds: number[]): Promise<void> {
  if (!sessionId || postoIds.length === 0) return;
  await fetch(`${API_BASE}/blocchi`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(sessionId) },
    body: JSON.stringify({ session_id: sessionId, posto_ids: postoIds }),
  });
}

export async function creaPrenotazione(
  postoIds: number[],
  nome: string,
  email: string,
  sessionId: string = ''
): Promise<{
  prenotazioni: import('../types').Prenotazione[];
  codice: string;
  codice_nuovo: boolean;
}> {
  const r = await fetch(`${API_BASE}/prenotazioni`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionId ? sessionHeaders(sessionId) : {}) },
    body: JSON.stringify({ posto_ids: postoIds, nome, email, session_id: sessionId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore prenotazione');
  return data;
}

export async function recuperaPrenotazioni(
  email: string,
  codice: string
): Promise<{ prenotazioni: import('../types').PrenotazioneConPosto[] }> {
  const r = await fetch(`${API_BASE}/prenotazioni/recupera`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), codice: codice.trim() }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error(data.error || 'Nessuna prenotazione trovata');
  if (!r.ok) throw new Error(data.error || 'Errore recupero prenotazione');
  return data;
}

export async function cancellaPrenotazione(id: number): Promise<void> {
  const r = await fetch(`${API_BASE}/prenotazioni/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Errore cancellazione');
}

export async function getPrenotazioni(): Promise<import('../types').Prenotazione[]> {
  const r = await fetch(`${API_BASE}/prenotazioni`);
  if (!r.ok) throw new Error('Errore caricamento prenotazioni');
  return r.json();
}

export async function getFile(password: string): Promise<{ file: string[]; riservate: string[] }> {
  const r = await fetch(`${API_BASE}/admin/file?password=${encodeURIComponent(password)}`);
  if (!r.ok) throw new Error('Non autorizzato');
  return r.json();
}

export async function setFilaRiservata(
  fila: string,
  riservato: boolean,
  password: string
): Promise<{ aggiornati: number }> {
  const r = await fetch(`${API_BASE}/admin/file/${encodeURIComponent(fila)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
    body: JSON.stringify({ riservato_staff: riservato }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore');
  return data;
}

export async function getAdminPosti(password: string): Promise<import('../types').Posto[]> {
  const r = await fetch(`${API_BASE}/admin/posti`, {
    headers: { 'X-Admin-Password': password },
  });
  if (!r.ok) throw new Error('Non autorizzato');
  return r.json();
}

export async function setPostoRiservato(
  postoId: number,
  riservato: boolean,
  password: string
): Promise<{ ok: boolean; riservato_staff: boolean }> {
  const r = await fetch(`${API_BASE}/admin/posti/${postoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
    body: JSON.stringify({ riservato_staff: riservato }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Errore');
  return data;
}

export async function getExportData(password: string): Promise<{
  bySeat: import('../types').ExportBySeat[];
  byPerson: import('../types').ExportByPerson[];
}> {
  const r = await fetch(`${API_BASE}/admin/export`, {
    headers: { 'X-Admin-Password': password },
  });
  if (!r.ok) throw new Error('Non autorizzato');
  return r.json();
}

export async function getImpostazioni(password: string): Promise<import('../types').Impostazioni> {
  const r = await fetch(`${API_BASE}/admin/impostazioni`, {
    headers: { 'X-Admin-Password': password },
  });
  if (!r.ok) throw new Error('Non autorizzato');
  return r.json();
}

export async function putImpostazioni(
  password: string,
  data: Partial<import('../types').Impostazioni>
): Promise<{ ok: boolean }> {
  const r = await fetch(`${API_BASE}/admin/impostazioni`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
    body: JSON.stringify(data),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Errore');
  return body;
}

export async function generaPosti(password: string): Promise<{ ok: boolean; creati: number }> {
  const r = await fetch(`${API_BASE}/admin/impostazioni/genera-posti`, {
    method: 'POST',
    headers: { 'X-Admin-Password': password },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Errore');
  return body;
}
