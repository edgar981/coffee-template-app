import type { OrderChannel } from '@/types/order';

export interface Customer {
  id:               string;
  nombre:           string;
  email?:           string;
  telefono?:        string;
  ciudad?:          string;
  direccion?:       string;
  canal?:           OrderChannel;
  notas?:           string;
  numero_ordenes?:  number;
  total_compras?:   number;
  activo:           boolean;
  createdAt:        string;
}

export interface CustomerForm {
  nombre:    string;
  email:     string;
  telefono:  string;
  ciudad:    string;
  direccion: string;
  canal:     OrderChannel;
  notas:     string;
  activo:   boolean;
}