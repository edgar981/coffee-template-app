export interface Notification {
  id:        string;
  tipo:      string;
  titulo:    string;
  mensaje:   string;
  leida:     boolean;
  href?:     string | null;
  createdAt: string;
}
