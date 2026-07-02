import type { Automation } from '@/types/automation';
import { AUTOMATION_TEMPLATES } from '@/lib/mock/automations';

// In-memory store so toggles persist within the session
let store: Automation[] = AUTOMATION_TEMPLATES.map(t => ({ ...t }));

export async function getAutomations(): Promise<Automation[]> {
  return new Promise(resolve => setTimeout(() => resolve([...store]), 400));
}

export async function createAutomation(data: Omit<Automation, 'id' | 'createdAt'>): Promise<Automation> {
  return new Promise(resolve =>
    setTimeout(() => resolve({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }), 300)
  );
}

export async function updateAutomation(id: string, data: Partial<Automation>): Promise<Automation> {
  const automation = store.find(a => a.id === id);
  if (!automation) throw new Error(`Automation ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...automation, ...data }), 300)
  );
}

export async function deleteAutomation(id: string): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300));
}

export async function toggleAutomation(tipo: string): Promise<Automation[]> {
  store = store.map(a =>
    a.tipo === tipo ? { ...a, activa: !a.activa } : a
  );
  return new Promise(resolve => setTimeout(() => resolve([...store]), 300));
}