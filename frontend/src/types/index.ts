export type PostoStato =
  | 'disponibile'
  | 'occupato'
  | 'non_disponibile'
  | 'selezionato'
  | 'bloccato'
  | 'bloccato_da_me';

export interface Posto {
  id: number;
  fila: string;
  numero: number;
  disponibile: boolean;
  riservato_staff: boolean;
  stato: 'disponibile' | 'occupato' | 'non_disponibile' | 'bloccato' | 'bloccato_da_me';
  /** Presente quando stato === 'occupato' (per colore per persona) */
  prenotazione_nome?: string;
  prenotazione_email?: string;
}

export interface ExportBySeat {
  fila: string;
  numero: number;
  posto: string;
  nome: string;
  email: string;
}

export interface ExportByPerson {
  nome: string;
  email: string;
  count: number;
  posti: string[];
}

export interface Prenotazione {
  id: number;
  posto_id: number;
  nome: string;
  email: string;
  timestamp: string | null;
  stato: string;
}
