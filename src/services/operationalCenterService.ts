import { supabase } from '../lib/supabase';
import type { Notification, Servico, ServiceEvent } from '../types';
import { coerceServiceStatus, toOperationalServiceState, updateServiceStatus } from './serviceStatus';

export type OperationalServiceState = 'Scheduled' | 'Active' | 'Completed' | 'Delayed';

export interface TimelineEntry {
    id: string;
    timestamp: string;
    description: string;
    locationId?: string | null;
}

export interface HotelMonthlyStats {
    month: string;
    hotel: string;
    totalTransportes: number;
    funcionariosTransportados: number;
    viagensRealizadas: number;
}

export interface EmployeeMonthlyStats {
    month: string;
    employeeId: string;
    employeeName: string;
    transportDays: number;
    totalCost: number;
}

export const getOperationalServiceState = (service: Servico, nowTs: number = Date.now()): OperationalServiceState => {
    const persistedStatus = coerceServiceStatus(service.status);
    const canonical = persistedStatus || updateServiceStatus(service, nowTs);
    return toOperationalServiceState(canonical);
};

export const formatStopDuration = (seconds?: number | null): string => {
    if (seconds === null || seconds === undefined || seconds < 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
};

const timelineLabels: Record<string, string> = {
    approaching_origin: 'Veículo aproximou-se da origem',
    entered_origin: 'Entrou na origem',
    left_origin: 'Saiu da origem',
    entered_destination: 'Entrou no destino',
    left_destination: 'Saiu do destino'
};

export const buildServiceTimeline = (events?: ServiceEvent[]): TimelineEntry[] => {
    if (!events || events.length === 0) return [];

    return [...events]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(event => ({
            id: event.id,
            timestamp: event.timestamp,
            description: timelineLabels[event.eventType] || event.eventType,
            locationId: event.locationId
        }));
};

export const getOperationalAlerts = (notifications: Notification[]): Notification[] => {
    return notifications
        .filter(n => n.type === 'system_alert')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const upsertServicePrimaryPassenger = async (services: Servico[]) => {
    const payload = services
        .filter(s => String(s.passageiro || '').trim().length > 0)
        .map(service => {
            const employeeName = String(service.passageiro || '').trim();
            const employeeId = employeeName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');

            return {
                service_id: service.id,
                employee_id: employeeId || `emp_${service.id}`,
                employee_name: employeeName,
                hotel_name: service.origem,
                transport_price_per_day: 0
            };
        });

    if (payload.length === 0) return;

    await supabase
        .from('service_passengers')
        .upsert(payload, { onConflict: 'service_id,employee_id' });
};

export const fetchHotelMonthlyStats = async (monthIso: string): Promise<HotelMonthlyStats[]> => {
    const { data, error } = await supabase
        .from('vw_transport_stats_by_hotel_monthly')
        .select('*')
        .eq('month', monthIso)
        .order('viagens_realizadas', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
        month: row.month,
        hotel: row.hotel,
        totalTransportes: Number(row.total_transportes || 0),
        funcionariosTransportados: Number(row.funcionarios_transportados || 0),
        viagensRealizadas: Number(row.viagens_realizadas || 0)
    }));
};

export const fetchEmployeeMonthlyStats = async (monthIso: string): Promise<EmployeeMonthlyStats[]> => {
    const { data, error } = await supabase
        .from('vw_employee_transport_monthly')
        .select('*')
        .eq('month', monthIso)
        .order('total_cost', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
        month: row.month,
        employeeId: row.employee_id,
        employeeName: row.employee_name || row.employee_id,
        transportDays: Number(row.transport_days || 0),
        totalCost: Number(row.total_cost || 0)
    }));
};