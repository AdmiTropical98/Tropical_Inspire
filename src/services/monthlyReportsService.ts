import { supabase } from '../lib/supabase';

export interface MonthlyReportFilters {
  month: number;
  year: number;
}

export interface DriverActivityReportRow {
  driverId: string;
  driverName: string;
  workedHours: number;
  servicesCount: number;
}

export interface MonthlyReportData {
  periodLabel: string;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalWorkshopRequisitionCost: number;
  totalOperationalCost: number;
  servicesCount: number;
  costsByClient: Array<{ clientId: string; clientName: string; totalCost: number }>;
  costsByVehicle: Array<{ vehicleId: string; vehicleName: string; totalCost: number }>;
  driverActivity: DriverActivityReportRow[];
}

type GenericRow = Record<string, unknown>;

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sumItemCost = (items: unknown): number => {
  if (!Array.isArray(items)) return 0;

  return items.reduce((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const row = item as GenericRow;
    const total = asNumber(row.valor_total);
    if (total > 0) return acc + total;

    const quantity = asNumber(row.quantidade);
    const unitValue = asNumber(row.valor_unitario);
    return acc + quantity * unitValue;
  }, 0);
};

const extractCost = (row: GenericRow, keys: string[]): number => {
  for (const key of keys) {
    if (key in row) {
      const value = asNumber(row[key]);
      if (value !== 0) return value;
    }
  }

  return 0;
};

const toDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getMonthBounds = (month: number, year: number) => {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
};

const matchesPeriod = (value: unknown, month: number, year: number): boolean => {
  const date = toDate(value);
  if (!date) return false;
  return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
};

const toHours = (startTime: unknown, endTime: unknown, breakDuration: unknown): number => {
  if (typeof startTime !== 'string' || typeof endTime !== 'string') return 0;

  const [startHour, startMinute] = startTime.split(':').map((x) => asNumber(x));
  const [endHour, endMinute] = endTime.split(':').map((x) => asNumber(x));

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const rawHours = (endMinutes - startMinutes) / 60;
  const breakHours = asNumber(breakDuration) / 60;
  return Math.max(rawHours - breakHours, 0);
};

export const getMonthlyReportData = async ({ month, year }: MonthlyReportFilters): Promise<MonthlyReportData> => {
  const { fromIso, toIso } = getMonthBounds(month, year);

  const [
    fuelResult,
    maintenanceResult,
    requisitionsResult,
    servicesResult,
    driversResult,
    vehiclesResult,
    clientsResult,
    manualHoursResult,
  ] = await Promise.all([
    supabase
      .from('fuel_transactions')
      .select('vehicle_id, total_cost, liters, timestamp')
      .gte('timestamp', fromIso)
      .lte('timestamp', toIso)
      .limit(5000),
    supabase
      .from('manutencoes')
      .select('vehicle_id, viatura_id, custo, data')
      .gte('data', fromIso)
      .lte('data', toIso)
      .limit(5000),
    supabase
      .from('requisicoes')
      .select('cliente_id, viatura_id, custo, approved_value, itens, data')
      .gte('data', fromIso)
      .lte('data', toIso)
      .limit(5000),
    supabase
      .from('servicos')
      .select('motorista_id, data, created_at')
      .limit(5000),
    supabase.from('motoristas').select('id, nome'),
    supabase.from('viaturas').select('id, matricula, marca, modelo'),
    supabase.from('clientes').select('id, nome'),
    supabase
      .from('manual_hours')
      .select('motorista_id, date, start_time, end_time, break_duration')
      .gte('date', fromIso.slice(0, 10))
      .lte('date', toIso.slice(0, 10))
      .limit(5000),
  ]);

  const fuelRows = (fuelResult.data ?? []) as GenericRow[];
  const maintenanceRows = (maintenanceResult.data ?? []) as GenericRow[];
  const requisitionRows = (requisitionsResult.data ?? []) as GenericRow[];

  const serviceRowsRaw = (servicesResult.data ?? []) as GenericRow[];
  const serviceRows = serviceRowsRaw.filter((row) => {
    if (matchesPeriod(row.data, month, year)) return true;
    return matchesPeriod(row.created_at, month, year);
  });

  const driverRows = (driversResult.data ?? []) as Array<{ id: string; nome: string | null }>;
  const vehicleRows = (vehiclesResult.data ?? []) as Array<{ id: string; matricula: string | null; marca: string | null; modelo: string | null }>;
  const clientRows = (clientsResult.data ?? []) as Array<{ id: string; nome: string | null }>;

  const manualHourRowsRaw = (manualHoursResult.data ?? []) as GenericRow[];
  const manualHourRows = manualHourRowsRaw.filter((row) => matchesPeriod(row.date, month, year));

  const totalFuelCost = fuelRows.reduce((acc, row) => {
    const cost = extractCost(row, ['total_cost', 'cost', 'custo']);
    return acc + cost;
  }, 0);

  const totalMaintenanceCost = maintenanceRows.reduce((acc, row) => {
    const cost = extractCost(row, ['custo', 'cost', 'total_cost']);
    return acc + cost;
  }, 0);

  const requisitionCosts = requisitionRows.map((row) => {
    const fromColumns = extractCost(row, ['custo', 'approved_value', 'total']);
    if (fromColumns !== 0) return fromColumns;
    return sumItemCost(row.itens);
  });

  const totalWorkshopRequisitionCost = requisitionCosts.reduce((acc, value) => acc + value, 0);
  const totalOperationalCost = totalFuelCost + totalMaintenanceCost + totalWorkshopRequisitionCost;

  const clientNameMap = new Map(clientRows.map((row) => [row.id, row.nome || 'Cliente sem nome']));
  const vehicleNameMap = new Map(vehicleRows.map((row) => {
    const label = [row.marca, row.modelo].filter(Boolean).join(' ').trim();
    const fallback = row.matricula || row.id;
    return [row.id, label.length > 0 ? `${label} (${fallback})` : fallback];
  }));
  const driverNameMap = new Map(driverRows.map((row) => [row.id, row.nome || 'Motorista sem nome']));

  const costsByClientMap = new Map<string, number>();
  requisitionRows.forEach((row, index) => {
    const clientId = typeof row.cliente_id === 'string' ? row.cliente_id : 'sem-cliente';
    const previous = costsByClientMap.get(clientId) ?? 0;
    costsByClientMap.set(clientId, previous + (requisitionCosts[index] ?? 0));
  });

  const costsByVehicleMap = new Map<string, number>();
  fuelRows.forEach((row) => {
    const vehicleId = typeof row.vehicle_id === 'string' ? row.vehicle_id : 'sem-viatura';
    costsByVehicleMap.set(vehicleId, (costsByVehicleMap.get(vehicleId) ?? 0) + extractCost(row, ['total_cost', 'cost', 'custo']));
  });

  maintenanceRows.forEach((row) => {
    const rawVehicleId = row.vehicle_id ?? row.viatura_id;
    const vehicleId = typeof rawVehicleId === 'string' ? rawVehicleId : 'sem-viatura';
    costsByVehicleMap.set(vehicleId, (costsByVehicleMap.get(vehicleId) ?? 0) + extractCost(row, ['custo', 'cost', 'total_cost']));
  });

  requisitionRows.forEach((row, index) => {
    const vehicleId = typeof row.viatura_id === 'string' ? row.viatura_id : 'sem-viatura';
    costsByVehicleMap.set(vehicleId, (costsByVehicleMap.get(vehicleId) ?? 0) + (requisitionCosts[index] ?? 0));
  });

  const servicesByDriverMap = new Map<string, number>();
  serviceRows.forEach((row) => {
    const driverId = typeof row.motorista_id === 'string' ? row.motorista_id : 'sem-motorista';
    servicesByDriverMap.set(driverId, (servicesByDriverMap.get(driverId) ?? 0) + 1);
  });

  const hoursByDriverMap = new Map<string, number>();
  manualHourRows.forEach((row) => {
    const driverId = typeof row.motorista_id === 'string' ? row.motorista_id : '';
    if (!driverId) return;
    const workedHours = toHours(row.start_time, row.end_time, row.break_duration);
    hoursByDriverMap.set(driverId, (hoursByDriverMap.get(driverId) ?? 0) + workedHours);
  });

  const driverIds = new Set<string>([
    ...Array.from(servicesByDriverMap.keys()),
    ...Array.from(hoursByDriverMap.keys()),
  ]);

  const driverActivity: DriverActivityReportRow[] = Array.from(driverIds)
    .filter((driverId) => driverId !== 'sem-motorista')
    .map((driverId) => ({
      driverId,
      driverName: driverNameMap.get(driverId) || 'Motorista sem nome',
      workedHours: Number((hoursByDriverMap.get(driverId) ?? 0).toFixed(2)),
      servicesCount: servicesByDriverMap.get(driverId) ?? 0,
    }))
    .sort((a, b) => b.servicesCount - a.servicesCount);

  const costsByClient = Array.from(costsByClientMap.entries())
    .map(([clientId, totalCost]) => ({
      clientId,
      clientName: clientId === 'sem-cliente' ? 'Sem cliente associado' : (clientNameMap.get(clientId) || clientId),
      totalCost,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const costsByVehicle = Array.from(costsByVehicleMap.entries())
    .map(([vehicleId, totalCost]) => ({
      vehicleId,
      vehicleName: vehicleId === 'sem-viatura' ? 'Sem viatura associada' : (vehicleNameMap.get(vehicleId) || vehicleId),
      totalCost,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const periodLabel = `${String(month).padStart(2, '0')}/${year}`;

  return {
    periodLabel,
    totalFuelCost,
    totalMaintenanceCost,
    totalWorkshopRequisitionCost,
    totalOperationalCost,
    servicesCount: serviceRows.length,
    costsByClient,
    costsByVehicle,
    driverActivity,
  };
};
