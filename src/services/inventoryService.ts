import { supabase } from '../lib/supabase';

export interface InventoryOffice {
  id: string;
  name: string;
  code?: string;
  city?: string;
  active?: boolean;
}

export interface InventoryMaterial {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  office_id?: string;
  quantity: number;
  minimum_quantity: number;
  unit_cost?: number;
  qr_code?: string;
  created_at?: string;
}

export interface InventoryEquipment {
  id: string;
  name: string;
  serial_number?: string;
  office_id?: string;
  assigned_user_id?: string;
  status: 'available' | 'assigned' | 'maintenance' | 'retired';
  qr_code?: string;
  created_at?: string;
}

export interface InventoryMovement {
  id: string;
  material_id?: string;
  equipment_id?: string;
  office_id?: string;
  movement_type: 'entry' | 'exit' | 'transfer';
  quantity?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface InventoryDashboardData {
  totals: {
    materials: number;
    equipments: number;
    offices: number;
    lowStock: number;
    monthlyEntries: number;
    monthlyExits: number;
    monthlyTransfers: number;
  };
  recentMovements: InventoryMovement[];
}

const FALLBACK_DASHBOARD: InventoryDashboardData = {
  totals: {
    materials: 0,
    equipments: 0,
    offices: 0,
    lowStock: 0,
    monthlyEntries: 0,
    monthlyExits: 0,
    monthlyTransfers: 0,
  },
  recentMovements: [],
};

function isMissingTableError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('relation') || message.includes('42p01');
}

export async function getInventoryDashboardData(): Promise<InventoryDashboardData> {
  try {
    const [materialsRes, equipmentsRes, officesRes, movementsRes] = await Promise.all([
      supabase
        .from('inv_materials')
        .select('id, quantity, minimum_quantity', { count: 'exact' }),
      supabase.from('inv_equipments').select('id', { count: 'exact' }),
      supabase.from('inv_offices').select('id', { count: 'exact' }),
      supabase
        .from('inv_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    const anyError = materialsRes.error || equipmentsRes.error || officesRes.error || movementsRes.error;
    if (anyError) {
      if (isMissingTableError(anyError)) return FALLBACK_DASHBOARD;
      throw anyError;
    }

    const materials = materialsRes.data || [];
    const movements = (movementsRes.data || []) as InventoryMovement[];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthMovements = movements.filter((movement) => new Date(movement.created_at) >= startOfMonth);

    return {
      totals: {
        materials: materialsRes.count || 0,
        equipments: equipmentsRes.count || 0,
        offices: officesRes.count || 0,
        lowStock: materials.filter((item) => (item.quantity || 0) <= (item.minimum_quantity || 0)).length,
        monthlyEntries: monthMovements.filter((movement) => movement.movement_type === 'entry').length,
        monthlyExits: monthMovements.filter((movement) => movement.movement_type === 'exit').length,
        monthlyTransfers: monthMovements.filter((movement) => movement.movement_type === 'transfer').length,
      },
      recentMovements: movements.slice(0, 12),
    };
  } catch (error) {
    console.error('Failed to load inventory dashboard data:', error);
    return FALLBACK_DASHBOARD;
  }
}

export async function quickSearchInventory(term: string): Promise<{
  materials: InventoryMaterial[];
  equipments: InventoryEquipment[];
  offices: InventoryOffice[];
}> {
  const query = term.trim();
  if (!query) {
    return { materials: [], equipments: [], offices: [] };
  }

  try {
    const [materialsRes, equipmentsRes, officesRes] = await Promise.all([
      supabase
        .from('inv_materials')
        .select('id, name, sku, category, office_id, quantity, minimum_quantity, unit_cost, created_at')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(8),
      supabase
        .from('inv_equipments')
        .select('id, name, serial_number, office_id, assigned_user_id, status, created_at')
        .or(`name.ilike.%${query}%,serial_number.ilike.%${query}%`)
        .limit(8),
      supabase
        .from('inv_offices')
        .select('id, name, code, city, active')
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(8),
    ]);

    if (materialsRes.error || equipmentsRes.error || officesRes.error) {
      const firstError = materialsRes.error || equipmentsRes.error || officesRes.error;
      if (isMissingTableError(firstError)) {
        return { materials: [], equipments: [], offices: [] };
      }
      throw firstError;
    }

    return {
      materials: (materialsRes.data || []) as InventoryMaterial[],
      equipments: (equipmentsRes.data || []) as InventoryEquipment[],
      offices: (officesRes.data || []) as InventoryOffice[],
    };
  } catch (error) {
    console.error('Failed to run inventory quick search:', error);
    return { materials: [], equipments: [], offices: [] };
  }
}

// ──────────────────────────────────────────────────────────
// Offices CRUD
// ──────────────────────────────────────────────────────────

export async function getOffices(): Promise<InventoryOffice[]> {
  const { data, error } = await supabase.from('inv_offices').select('*').order('name');
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data || []) as InventoryOffice[];
}

export async function createOffice(payload: Omit<InventoryOffice, 'id'>): Promise<InventoryOffice> {
  const { data, error } = await supabase.from('inv_offices').insert(payload).select().single();
  if (error) throw error;
  return data as InventoryOffice;
}

export async function updateOffice(id: string, payload: Partial<Omit<InventoryOffice, 'id'>>): Promise<void> {
  const { error } = await supabase.from('inv_offices').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteOffice(id: string): Promise<void> {
  const { error } = await supabase.from('inv_offices').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────
// Materials CRUD
// ──────────────────────────────────────────────────────────

export interface MaterialFilters { search?: string; category?: string; officeId?: string; lowStock?: boolean; }

export async function getMaterials(filters: MaterialFilters = {}): Promise<InventoryMaterial[]> {
  let query = supabase.from('inv_materials').select('*').order('name');
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.officeId) query = query.eq('office_id', filters.officeId);
  const { data, error } = await query;
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  const rows = (data || []) as InventoryMaterial[];
  if (filters.lowStock) return rows.filter((r) => r.quantity <= r.minimum_quantity);
  return rows;
}

export async function createMaterial(payload: Omit<InventoryMaterial, 'id' | 'created_at' | 'qr_code'>): Promise<InventoryMaterial> {
  const qr_code = `INV-MAT-${crypto.randomUUID()}`;
  const { data, error } = await supabase.from('inv_materials').insert({ ...payload, qr_code }).select().single();
  if (error) throw error;
  return data as InventoryMaterial;
}

export async function updateMaterial(id: string, payload: Partial<Omit<InventoryMaterial, 'id'>>): Promise<void> {
  const { error } = await supabase.from('inv_materials').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('inv_materials').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────
// Equipments CRUD
// ──────────────────────────────────────────────────────────

export async function getEquipments(search?: string): Promise<InventoryEquipment[]> {
  let query = supabase.from('inv_equipments').select('*').order('name');
  if (search) query = query.or(`name.ilike.%${search}%,serial_number.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data || []) as InventoryEquipment[];
}

export async function createEquipment(payload: Omit<InventoryEquipment, 'id' | 'created_at'>): Promise<InventoryEquipment> {
  const qr_code = payload.qr_code || `INV-EQP-${crypto.randomUUID()}`;
  const { data, error } = await supabase.from('inv_equipments').insert({ ...payload, qr_code }).select().single();
  if (error) throw error;
  return data as InventoryEquipment;
}

export async function updateEquipment(id: string, payload: Partial<Omit<InventoryEquipment, 'id'>>): Promise<void> {
  const { error } = await supabase.from('inv_equipments').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('inv_equipments').delete().eq('id', id);
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────
// Movements
// ──────────────────────────────────────────────────────────

export async function getMovements(type?: InventoryMovement['movement_type'], limit = 100): Promise<InventoryMovement[]> {
  let query = supabase.from('inv_movements').select('*').order('created_at', { ascending: false }).limit(limit);
  if (type) query = query.eq('movement_type', type);
  const { data, error } = await query;
  if (error) { if (isMissingTableError(error)) return []; throw error; }
  return (data || []) as InventoryMovement[];
}

export async function createMovement(payload: Omit<InventoryMovement, 'id' | 'created_at'>): Promise<InventoryMovement> {
  const { data, error } = await supabase.from('inv_movements').insert(payload).select().single();
  if (error) throw error;
  return data as InventoryMovement;
}

