import type { Servico } from '../types';

export type DispatchServiceStatus =
    | 'SCHEDULED'
    | 'DRIVER_ASSIGNED'
    | 'EN_ROUTE_ORIGIN'
    | 'ARRIVED_ORIGIN'
    | 'BOARDING'
    | 'EN_ROUTE_DESTINATION'
    | 'COMPLETED';

const ALLOWED: DispatchServiceStatus[] = [
    'SCHEDULED',
    'DRIVER_ASSIGNED',
    'EN_ROUTE_ORIGIN',
    'ARRIVED_ORIGIN',
    'BOARDING',
    'EN_ROUTE_DESTINATION',
    'COMPLETED'
];

export const parseServiceDateTime = (serviceDate?: string, serviceHour?: string): Date | null => {
    if (!serviceHour) return null;

    if (serviceHour.includes('T') || serviceHour.includes('-')) {
        const parsed = new Date(serviceHour);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (!serviceHour.includes(':')) return null;

    const dateBase = serviceDate || new Date().toISOString().split('T')[0];
    const parsed = new Date(`${dateBase}T${serviceHour}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const coerceServiceStatus = (rawStatus?: string | null): DispatchServiceStatus | null => {
    const normalized = String(rawStatus || '').trim();
    if (!normalized) return null;

    const upper = normalized.toUpperCase();
    if (ALLOWED.includes(upper as DispatchServiceStatus)) {
        return upper as DispatchServiceStatus;
    }

    const legacy = normalized.toLowerCase();
    if (legacy === 'completed') return 'COMPLETED';
    if (legacy === 'scheduled' || legacy === 'pending') return 'SCHEDULED';
    if (legacy === 'active' || legacy === 'started') return 'EN_ROUTE_ORIGIN';
    if (legacy === 'delayed' || legacy === 'failed') return 'DRIVER_ASSIGNED';

    return null;
};

export const updateServiceStatus = (
    service: Pick<Servico, 'data' | 'hora' | 'motoristaId' | 'originConfirmed' | 'originArrivalTime' | 'originDepartureTime' | 'destinationConfirmed' | 'destinationArrivalTime'>,
    nowTs: number = Date.now()
): DispatchServiceStatus => {
    const destinationConfirmed = Boolean(service.destinationConfirmed || service.destinationArrivalTime);
    if (destinationConfirmed) return 'COMPLETED';

    const hasDriver = Boolean(service.motoristaId);
    if (!hasDriver) return 'SCHEDULED';

    const scheduledDateTime = parseServiceDateTime(service.data, service.hora);
    if (scheduledDateTime && nowTs < scheduledDateTime.getTime()) return 'SCHEDULED';

    const originConfirmed = Boolean(service.originConfirmed || service.originArrivalTime);
    if (!originConfirmed) return 'DRIVER_ASSIGNED';

    if (service.originDepartureTime) return 'EN_ROUTE_DESTINATION';
    return 'ARRIVED_ORIGIN';
};

export const toOperationalServiceState = (status: DispatchServiceStatus): 'Scheduled' | 'Active' | 'Delayed' | 'Completed' => {
    if (status === 'SCHEDULED' || status === 'DRIVER_ASSIGNED') return 'Scheduled';
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'EN_ROUTE_ORIGIN' || status === 'ARRIVED_ORIGIN' || status === 'BOARDING' || status === 'EN_ROUTE_DESTINATION') return 'Active';
    return 'Delayed';
};

export const toDispatchStageLabel = (status: DispatchServiceStatus): string => {
    if (status === 'SCHEDULED') return 'SCHEDULED';
    if (status === 'DRIVER_ASSIGNED') return 'DRIVER_ASSIGNED';
    if (status === 'EN_ROUTE_ORIGIN') return 'EN_ROUTE_ORIGIN';
    if (status === 'ARRIVED_ORIGIN') return 'ARRIVED_ORIGIN';
    if (status === 'BOARDING') return 'BOARDING';
    if (status === 'EN_ROUTE_DESTINATION') return 'EN_ROUTE_DESTINATION';
    return 'COMPLETED';
};
