import type { Automation } from '@/types/automation';

export async function getAutomations(): Promise<Automation[]> {
  const res = await fetch('/api/automations');
  if (!res.ok) throw new Error('Error al cargar automatizaciones');
  return res.json();
}

export async function toggleAutomation(tipo: string): Promise<Automation[]> {
  const res = await fetch(`/api/automations/${tipo}/toggle`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Error al actualizar automatización');
  return res.json();
}