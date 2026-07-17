export interface Agenda {
  id: string;
  title: string;
  date: string;
  price: number;
  meeting_point: string;
  description: string;
  requirements?: string;
  max_capacity?: number;
  duration_hours?: number;
  distance_km?: number;
  difficulty?: string;
  flyer_url?: string;
  images?: string[];
  video_url?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  full_name: string;
  cpf: string;
  rg: string;
  birth_date: string;
  phone: string;
  email: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  health_notes?: string;
  image_authorization?: boolean;
  signature_url?: string;
  accepted_terms_at?: string;
  photo_url?: string;
  pontos?: number;
  cashback_saldo?: number;
  created_at?: string;
}

export interface Reserva {
  id: string;
  client_id: string;
  agenda_id: string;
  status_pagamento: 'pago' | 'pendente' | 'atrasado' | 'cancelado' | 'estornado' | 'expirado';
  valor_pago: number;
  valor_original?: number;
  cashback_usado?: number;
  pontos_usados?: number;
  purchase_channel?: 'site' | 'app' | 'admin';
  created_at?: string;
  clients?: Client;
  agendas?: Agenda;
}

export interface Avaliacao {
  id: string;
  agenda_id: string;
  name: string;
  rating: number;
  comment: string;
  approved: boolean;
  created_at?: string;
  agendas?: { title: string };
}
