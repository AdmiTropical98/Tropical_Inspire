import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Fornecedor, Requisicao, Viatura, Motorista, Supervisor, Gestor, Notification, OficinaUser, FuelTank, FuelTransaction, TankRefillLog, CentroCusto, EvaTransport, Cliente, AdminUser, Servico, Avaliacao, ManualHourRecord, Local, ScaleBatch, VehicleMetrics, RotaPlaneada, LogOperacional, ZonaOperacional, AreaOperacional, EscalaTemplate, EscalaTemplateItem, ServiceEvent, DriverVehicleSession } from '../types';
import { CartrackService, getTagVariants, cleanTagId, type CartrackGeofence, type CartrackGeofenceVisit } from '../services/cartrack';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { usePermissions } from './PermissionsContext';
import { updateServiceStatus, coerceServiceStatus, parseServiceDateTime } from '../services/serviceStatus';

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in metres
};

const normalizeName = (name?: string | null) =>
    String(name || '')
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, ""); // Also remove non-alphanumeric except spaces

const isNameMatch = (nameA?: string | null, nameB?: string | null) => {
    const a = normalizeName(nameA);
    const b = normalizeName(nameB);
    if (!a || !b) return false;
    if (a === b) return true;
    
    // Check if one contains the other as a significant part
    if (a.length < 3 || b.length < 3) return a === b;
    
    const wordsA = a.split(/\s+/).filter(w => w.length > 1);
    const wordsB = b.split(/\s+/).filter(w => w.length > 1);
    
    if (wordsA.length === 0 || wordsB.length === 0) return a === b;

    // High confidence: At least two significant words match in any order
    const commonWords = wordsA.filter(w => wordsB.includes(w));
    if (commonWords.length >= 2) return true;

    // Fallback: One significant word match if it's the ONLY significant word in one of them
    if ((wordsA.length === 1 || wordsB.length === 1) && commonWords.length >= 1) return true;
    
    // Last resort: String inclusion if long enough (e.g., "EDSON RODRIGUES OBRA" and "EDSON RODRIGUES")
    if (a.length > 8 && b.length > 8 && (a.includes(b) || b.includes(a))) return true;

    return false;
};

const isServiceUrgent = (serviceDate?: string, serviceHour?: string) => {
    if (!serviceHour) return false;

    const [hoursRaw, minutesRaw] = serviceHour.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

    const dateBase = serviceDate || new Date().toISOString().split('T')[0];
    const serviceDateTime = new Date(`${dateBase}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    if (Number.isNaN(serviceDateTime.getTime())) return false;

    const diffMinutes = (serviceDateTime.getTime() - Date.now()) / 60000;
    return diffMinutes >= 0 && diffMinutes < 60;
};

const deriveServiceLifecycleStatus = ({
    motoristaId,
    serviceDate,
    serviceHour,
    originConfirmed,
    originDepartureTime,
    destinationConfirmed,
    nowTs = Date.now()
}: {
    motoristaId?: string | null;
    serviceDate?: string;
    serviceHour?: string;
    originConfirmed?: boolean;
    originDepartureTime?: string | null;
    destinationConfirmed?: boolean;
    nowTs?: number;
}) => {
    return updateServiceStatus({
        data: serviceDate || '',
        hora: serviceHour || '00:00',
        motoristaId,
        originConfirmed,
        originDepartureTime,
        destinationConfirmed
    }, nowTs);
};

// Maps the granular lifecycle status to the simplified values the DB constraint accepts.
// If the DB constraint has been updated to accept the full set, this is a no-op.
const normalizeStatusForDb = (status: string): string => {
    if (status === 'COMPLETED') return 'completed';
    if (['EN_ROUTE_ORIGIN', 'ARRIVED_ORIGIN', 'BOARDING', 'EN_ROUTE_DESTINATION'].includes(status)) return 'active';
    // SCHEDULED and DRIVER_ASSIGNED both map to 'scheduled'
    return 'scheduled';
};

const isMissingUrgentColumnError = (error: any) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return message.includes('is_urgent') &&
        (
            message.includes('schema cache') ||
            message.includes('column') ||
            message.includes('does not exist') ||
            message.includes('could not find')
        );
};

const isMissingServiceGeofencingColumnError = (error: any) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    const missingGeofenceColumn =
        message.includes('origem_location_id') ||
        message.includes('destino_location_id') ||
        message.includes('origin_arrival_time') ||
        message.includes('destination_arrival_time') ||
        message.includes('origin_confirmed') ||
        message.includes('destination_confirmed') ||
        message.includes('origin_departure_time') ||
        message.includes('destination_departure_time');

    return missingGeofenceColumn &&
        (
            message.includes('schema cache') ||
            message.includes('column') ||
            message.includes('does not exist') ||
            message.includes('could not find')
        );
};

const isMissingServiceAutoDispatchColumnError = (error: any) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    const missingAutoDispatchColumn =
        message.includes('vehicle_id') ||
        message.includes('passenger_count') ||
        message.includes('occupancy_rate');

    return missingAutoDispatchColumn &&
        (
            message.includes('schema cache') ||
            message.includes('column') ||
            message.includes('does not exist') ||
            message.includes('could not find')
        );
};

const isMissingDriverVehicleSessionsTableError = (error: any) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return message.includes('driver_vehicle_sessions') && (
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('relation')
    );
};

const isMissingTipoUtilizadorColumnError = (error: any) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return message.includes('tipo_utilizador') && (
        message.includes('schema cache') ||
        message.includes('column') ||
        message.includes('does not exist') ||
        message.includes('could not find')
    );
};

interface WorkshopContextType {
    fornecedores: Fornecedor[];
    setFornecedores: React.Dispatch<React.SetStateAction<Fornecedor[]>>;
    viaturas: Viatura[];
    setViaturas: React.Dispatch<React.SetStateAction<Viatura[]>>;
    clientes: Cliente[];
    setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
    requisicoes: Requisicao[];
    setRequisicoes: React.Dispatch<React.SetStateAction<Requisicao[]>>;
    centrosCustos: CentroCusto[]; // NEW
    setCentrosCustos: React.Dispatch<React.SetStateAction<CentroCusto[]>>;
    evaTransports: EvaTransport[];
    setEvaTransports: React.Dispatch<React.SetStateAction<EvaTransport[]>>;
    motoristas: Motorista[];
    setMotoristas: React.Dispatch<React.SetStateAction<Motorista[]>>;
    supervisors: Supervisor[];
    setSupervisors: React.Dispatch<React.SetStateAction<Supervisor[]>>;
    gestores: Gestor[];
    setGestores: React.Dispatch<React.SetStateAction<Gestor[]>>;
    oficinaUsers: OficinaUser[];
    setOficinaUsers: React.Dispatch<React.SetStateAction<OficinaUser[]>>;
    notifications: Notification[];
    servicos: any[];
    setServicos: React.Dispatch<React.SetStateAction<any[]>>;
    scaleBatches: ScaleBatch[];
    zonasOperacionais: ZonaOperacional[];
    areasOperacionais: AreaOperacional[];
    escalaTemplates: EscalaTemplate[];
    escalaTemplateItems: EscalaTemplateItem[];
    geofences: CartrackGeofence[];
    geofenceVisits: CartrackGeofenceVisit[]; // NEW
    cartrackVehicles: import('../services/cartrack').CartrackVehicle[];
    cartrackDrivers: import('../services/cartrack').CartrackDriver[];

    cartrackError: string | null;
    dbConnectionError: string | null; // NEW: Explicit DB Error

    // Routing
    rotasPlaneadas: RotaPlaneada[];
    saveRoute: (route: Partial<RotaPlaneada>) => Promise<{ success: boolean; data?: any; error?: any }>;
    updateRouteStatus: (id: string, status: 'concluida' | 'cancelada', realDistance?: number, justification?: string) => Promise<void>;

    // Auditing
    logsOperacionais: LogOperacional[];
    registerLog: (log: Omit<LogOperacional, 'id' | 'data_hora'>) => Promise<void>;

    // POI / Locais
    locais: Local[];
    addLocal: (l: Local) => Promise<void>;
    updateLocal: (l: Local) => Promise<void>;
    deleteLocal: (id: string) => Promise<void>;
    checkRouteValidation: (serviceId: string) => Promise<Record<string, { status: 'success' | 'failed'; time?: string; distance?: number }>>;

    // Scale Batch Actions
    createScaleBatch: (batchData: { notes?: string, centroCustoId: string, referenceDate: string }, services: Servico[]) => Promise<{ success: boolean; data?: any; error?: any }>;
    cancelScaleBatch: (batchId: string) => Promise<{ success: boolean; error?: any }>;
    publishBatch: (batchId: string) => Promise<{ success: boolean; error?: any }>;

    // Fuel
    fuelTank: FuelTank;
    fuelTransactions: FuelTransaction[];
    tankRefills: TankRefillLog[];
    vehicleMetrics: VehicleMetrics[];
    updateFuelTank: (tank: FuelTank) => void;
    registerRefuel: (transaction: FuelTransaction) => void;
    confirmRefuel: (transactionId: string) => Promise<{ error?: any } | void>;
    registerTankRefill: (log: TankRefillLog) => void;
    setPumpTotalizer: (val: number) => void;
    deleteFuelTransaction: (id: string) => void;
    updateFuelTransaction: (id: string, updates: Partial<FuelTransaction>) => Promise<{ error?: any }>;
    deleteTankRefill: (id: string) => void;
    recalculateFuelTank: () => Promise<{ newLevel: number; newTotalizer: number }>;

    // Manual Hours
    manualHours: import('../types').ManualHourRecord[];
    addManualHourRecord: (record: import('../types').ManualHourRecord) => Promise<void>;
    deleteManualHourRecord: (id: string) => Promise<void>;

    // Workshop Stock
    stockItems: import('../types').StockItem[];
    setStockItems: React.Dispatch<React.SetStateAction<import('../types').StockItem[]>>;
    stockMovements: import('../types').StockMovement[];
    setStockMovements: React.Dispatch<React.SetStateAction<import('../types').StockMovement[]>>;

    addStockItem: (item: Omit<import('../types').StockItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    updateStockItem: (item: import('../types').StockItem) => Promise<void>;
    deleteStockItem: (id: string) => Promise<void>;
    createStockMovement: (movement: Omit<import('../types').StockMovement, 'id' | 'created_at'>) => Promise<void>;
    refreshInventoryData: () => Promise<void>;
    syncStockRequisitionsToInventory: () => Promise<{ processed: number; failed: number }>;

    // Workshop Assets
    workshopAssets: import('../types').WorkshopAsset[];
    setWorkshopAssets: React.Dispatch<React.SetStateAction<import('../types').WorkshopAsset[]>>;
    addWorkshopAsset: (asset: Omit<import('../types').WorkshopAsset, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    updateWorkshopAsset: (asset: import('../types').WorkshopAsset) => Promise<void>;
    deleteWorkshopAsset: (id: string) => Promise<void>;
    assignWorkshopAsset: (assetId: string, technicianId: string | null) => Promise<void>;

    addFornecedor: (f: Fornecedor) => void;
    updateFornecedor: (f: Fornecedor) => Promise<void>;
    deleteFornecedor: (id: string) => void;
    addCliente: (c: Cliente) => void;
    updateCliente: (c: Cliente) => void;
    deleteCliente: (id: string) => void;
    addViatura: (v: Viatura) => void;
    updateViatura: (v: Viatura) => void;
    deleteViatura: (id: string) => void;
    addRequisicao: (r: Requisicao) => void;
    updateRequisicao: (r: Requisicao) => void;
    deleteRequisicao: (id: string) => void;
    toggleRequisicaoStatus: (
        id: string,
        faturas?: {
            numero: string;
            valor_liquido: number;
            iva_taxa: number;
            iva_valor: number;
            valor_total: number;
        }[]
    ) => Promise<void>;
    addCentroCusto: (cc: CentroCusto) => void; // NEW
    deleteCentroCusto: (id: string) => void; // NEW
    addEvaTransport: (t: EvaTransport) => void;
    deleteEvaTransport: (id: string) => void;
    addMotorista: (m: Motorista) => void;
    updateMotorista: (m: Motorista) => void;
    deleteMotorista: (id: string) => void;
    addSupervisor: (s: Supervisor) => void;
    updateSupervisor: (s: Supervisor) => void;
    deleteSupervisor: (id: string) => void;
    addGestor: (g: Gestor) => Promise<{ error?: any } | void>;
    updateGestor: (g: Gestor) => void;
    deleteGestor: (id: string) => void;
    addOficinaUser: (u: OficinaUser) => Promise<{ error?: any } | void>;
    updateOficinaUser: (u: OficinaUser) => void;
    deleteOficinaUser: (id: string) => void;
    addNotification: (n: Notification) => void;
    updateNotification: (n: Notification) => Promise<{ error: any }>;
    refreshData: () => Promise<void>;
    adminUsers: AdminUser[];
    createAdminUser: (email: string, password: string, nome: string) => Promise<{ success: boolean; error?: string }>;
    deleteAdminUser: (id: string) => Promise<void>;
    addServico: (s: Servico) => Promise<void>;
    updateServico: (s: Servico) => Promise<void>;
    deleteServico: (id: string) => Promise<void>;
    avaliacoes: Avaliacao[];
    addAvaliacao: (a: Avaliacao) => Promise<void>;
    complianceStats: Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }>;
    runComplianceCheck: () => Promise<void>;
    runComplianceDemo: () => void;
    updateVehicleLocation: (registration: string, lat: number, lng: number) => Promise<void>;
    getVehicleOccupancyHistory: (vehicleId: string, startDate: string, endDate: string) => Promise<{ date: string, centroCustoId: string | null }[]>;
    geofenceMappings: Record<string, string>;
    updateGeofenceMapping: (geofenceName: string, centroCustoId: string) => Promise<void>;
    syncRealTimeRentals: () => Promise<void>;

    // NEW: Zonas Operacionais CRUD
    addZonaOperacional: (z: Omit<ZonaOperacional, 'id' | 'created_at'>) => Promise<void>;
    updateZonaOperacional: (z: ZonaOperacional) => Promise<void>;
    deleteZonaOperacional: (id: string) => Promise<void>;

    // NEW: Areas Operacionais CRUD
    addAreaOperacional: (a: Omit<AreaOperacional, 'id' | 'created_at'>) => Promise<void>;
    updateAreaOperacional: (a: AreaOperacional) => Promise<void>;
    deleteAreaOperacional: (id: string) => Promise<void>;

    // NEW: Escala Templates CRUD
    addEscalaTemplate: (template: Omit<EscalaTemplate, 'id' | 'created_at'>, items: Omit<EscalaTemplateItem, 'id' | 'created_at' | 'template_id'>[]) => Promise<{ success: boolean; error?: any }>;
    deleteEscalaTemplate: (id: string) => Promise<void>;
    updateEscalaTemplate: (id: string, name: string) => Promise<void>;
    addTemplateItem: (item: Omit<EscalaTemplateItem, 'id' | 'created_at'>) => Promise<void>;
    deleteTemplateItem: (id: string) => Promise<void>;

}

const WorkshopContext = createContext<WorkshopContextType | undefined>(undefined);

export function WorkshopProvider({ children }: { children: React.ReactNode }) {

    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [viaturas, setViaturas] = useState<Viatura[]>([]);
    const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
    const [locais, setLocais] = useState<Local[]>([]); // POIs
    const [centrosCustos, setCentrosCustos] = useState<CentroCusto[]>([]);
    const [geofences, setGeofences] = useState<CartrackGeofence[]>([]);
    const [geofenceVisits, setGeofenceVisits] = useState<CartrackGeofenceVisit[]>([]); // NEW
    const [cartrackVehicles, setCartrackVehicles] = useState<import('../services/cartrack').CartrackVehicle[]>([]);
    const [cartrackDrivers, setCartrackDrivers] = useState<import('../services/cartrack').CartrackDriver[]>([]);
    const [cartrackError, setCartrackError] = useState<string | null>(null);
    const [dbConnectionError, setDbConnectionError] = useState<string | null>(null);




    const [evaTransports, setEvaTransports] = useState<EvaTransport[]>([]);



    const [motoristas, setMotoristas] = useState<Motorista[]>([]);





    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [oficinaUsers, setOficinaUsers] = useState<OficinaUser[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
    const [vehicleMetrics, setVehicleMetrics] = useState<VehicleMetrics[]>([]);



    // LocalStorage sync removed as we are now using Supabase
    // Cross-tab sync should be handled by Supabase Realtime in the future

    // NEW: Services State (Lifted)
    const [servicos, setServicos] = useState<any[]>([]);
    const [serviceEvents, setServiceEvents] = useState<ServiceEvent[]>([]);
    const [driverVehicleSessions, setDriverVehicleSessions] = useState<DriverVehicleSession[]>([]);
    const [scaleBatches, setScaleBatches] = useState<ScaleBatch[]>([]);
    const [zonasOperacionais, setZonasOperacionais] = useState<ZonaOperacional[]>([]);
    const [areasOperacionais, setAreasOperacionais] = useState<AreaOperacional[]>([]);
    const [escalaTemplates, setEscalaTemplates] = useState<EscalaTemplate[]>([]);
    const [escalaTemplateItems, setEscalaTemplateItems] = useState<EscalaTemplateItem[]>([]);

    const [stockItems, setStockItems] = useState<import('../types').StockItem[]>([]);
    const [stockMovements, setStockMovements] = useState<import('../types').StockMovement[]>([]);
    const [workshopAssets, setWorkshopAssets] = useState<import('../types').WorkshopAsset[]>([]);




    // COMPLIANCE LOGIC
    const [complianceStats, setComplianceStats] = useState<Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }>>({});
    const [geofenceMappings, setGeofenceMappings] = useState<Record<string, string>>({});
    const STOCK_REQUISITION_SYNC_ENABLED = false;
    const stockSyncInProgressReqIdsRef = useRef<Set<string>>(new Set());
    const stockBackfillRunningRef = useRef(false);
    const stockItemsTableRef = useRef<'stock_items' | 'workshop_items'>('stock_items');
    const supportsUrgentColumnRef = useRef(true);
    const supportsServiceGeofencingColumnsRef = useRef(true);
    const supportsServiceAutoDispatchColumnsRef = useRef(true);
    const supportsServiceEventsTableRef = useRef(true);
    const supportsDriverVehicleSessionsTableRef = useRef(true);
    const autoGeofenceSyncRunningRef = useRef(false);
    const prevVehiclePositionsRef = useRef<Record<string, { latitude: number; longitude: number; timestamp: string }>>({});
    const lowSpeedStartByServiceRef = useRef<Record<string, number>>({});

    const isMissingStockTableError = (error: any, table: 'stock_items' | 'workshop_items') => {
        if (!error) return false;
        const message = String(error.message || '').toLowerCase();
        return message.includes(`public.${table}`) || message.includes(`relation \"public.${table}\"`);
    };

    const normalizeStockCategory = (value?: string | null) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const isRequisitionCategory = (value?: string | null) => normalizeStockCategory(value) === 'requisicao';

    const resolveStockItemsTable = async (): Promise<'stock_items' | 'workshop_items'> => {
        let table = stockItemsTableRef.current;
        const probe = await supabase.from(table).select('id').limit(1);

        if (!probe.error) return table;

        if (table === 'stock_items' && isMissingStockTableError(probe.error, 'stock_items')) {
            table = 'workshop_items';
            stockItemsTableRef.current = table;
            return table;
        }

        if (table === 'workshop_items' && isMissingStockTableError(probe.error, 'workshop_items')) {
            table = 'stock_items';
            stockItemsTableRef.current = table;
            return table;
        }

        return table;
    };

    // Helper: Haversine Distance (km)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d * 1000; // Returns meters
    };

    const normalizeLocationName = (value?: string | null) => {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    };

    const resolveLocationByName = (locationName?: string, explicitId?: string | null) => {
        if (explicitId) {
            return locais.find(l => l.id === explicitId) || null;
        }

        const normalizedTarget = normalizeLocationName(locationName);
        if (!normalizedTarget) return null;

        return locais.find(local => {
            const normalizedLocal = normalizeLocationName(local.nome);
            return normalizedLocal.includes(normalizedTarget) || normalizedTarget.includes(normalizedLocal);
        }) || null;
    };

    const stripGeofencingColumnsFromPayload = (payload: any) => {
        const {
            origem_location_id,
            destino_location_id,
            origin_arrival_time,
            destination_arrival_time,
            origin_confirmed,
            destination_confirmed,
            origin_departure_time,
            destination_departure_time,
            ...rest
        } = payload;
        return rest;
    };

    const stripAutoDispatchColumnsFromPayload = (payload: any) => {
        const {
            vehicle_id,
            passenger_count,
            occupancy_rate,
            ...rest
        } = payload;
        return rest;
    };

    const getVehicleByDriver = async (driverId: string, activeSessionsByDriver?: Map<string, string>): Promise<string | null> => {
        if (activeSessionsByDriver?.has(driverId)) {
            return activeSessionsByDriver.get(driverId) || null;
        }

        const inMemorySession = driverVehicleSessions
            .filter(s => s.driverId === driverId && s.active)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

        if (inMemorySession?.vehicleId) return inMemorySession.vehicleId;

        if (!supportsDriverVehicleSessionsTableRef.current) return null;

        const { data, error } = await supabase.rpc('get_vehicle_by_driver', { p_driver_id: driverId });

        if (error) {
            if (isMissingDriverVehicleSessionsTableError(error)) {
                supportsDriverVehicleSessionsTableRef.current = false;
                return null;
            }
            console.warn('Falha ao obter viatura ativa por motorista:', error);
            return null;
        }

        if (!data) return null;
        return String(data);
    };

    const syncDriverVehicleSessions = async (assignments: Array<{ driverId: string; vehicleId: string; moving: boolean; timestamp: string }>) => {
        if (!supportsDriverVehicleSessionsTableRef.current) return;
        if (assignments.length === 0) return;

        try {
            const { data: activeRows, error: fetchError } = await supabase
                .from('driver_vehicle_sessions')
                .select('*')
                .eq('active', true)
                .order('start_time', { ascending: false });

            if (fetchError) {
                if (isMissingDriverVehicleSessionsTableError(fetchError)) {
                    supportsDriverVehicleSessionsTableRef.current = false;
                    return;
                }
                console.warn('Falha ao carregar sessões ativas motorista/viatura:', fetchError);
                return;
            }

            const activeSessions = (activeRows || []).map((row: any) => ({
                id: row.id,
                driverId: row.driver_id,
                vehicleId: row.vehicle_id,
                startTime: row.start_time,
                endTime: row.end_time,
                active: Boolean(row.active)
            } as DriverVehicleSession));

            const nowIso = new Date().toISOString();

            for (const assignment of assignments) {
                const normalizedDriverId = String(assignment.driverId);
                const normalizedVehicleId = String(assignment.vehicleId);
                const isMoving = assignment.moving;

                const samePairActive = activeSessions.find(session =>
                    session.active &&
                    session.driverId === normalizedDriverId &&
                    session.vehicleId === normalizedVehicleId
                );

                if (samePairActive && isMoving) continue;

                const sessionsToClose = activeSessions.filter(session =>
                    session.active && (
                        session.driverId === normalizedDriverId ||
                        session.vehicleId === normalizedVehicleId
                    )
                );

                if (sessionsToClose.length > 0) {
                    const idsToClose = sessionsToClose.map(session => session.id);
                    const { error: closeError } = await supabase
                        .from('driver_vehicle_sessions')
                        .update({
                            active: false,
                            end_time: assignment.timestamp || nowIso
                        })
                        .in('id', idsToClose);

                    if (closeError && !isMissingDriverVehicleSessionsTableError(closeError)) {
                        console.warn('Falha ao fechar sessões motorista/viatura:', closeError);
                    }

                    sessionsToClose.forEach(session => {
                        session.active = false;
                        session.endTime = assignment.timestamp || nowIso;
                    });
                }

                if (!isMoving) continue;

                const { data: inserted, error: insertError } = await supabase
                    .from('driver_vehicle_sessions')
                    .insert({
                        driver_id: normalizedDriverId,
                        vehicle_id: normalizedVehicleId,
                        start_time: assignment.timestamp || nowIso,
                        active: true
                    })
                    .select('*')
                    .single();

                if (insertError) {
                    if (isMissingDriverVehicleSessionsTableError(insertError)) {
                        supportsDriverVehicleSessionsTableRef.current = false;
                        return;
                    }
                    console.warn('Falha ao criar sessão motorista/viatura:', insertError);
                    continue;
                }

                activeSessions.push({
                    id: inserted.id,
                    driverId: inserted.driver_id,
                    vehicleId: inserted.vehicle_id,
                    startTime: inserted.start_time,
                    endTime: inserted.end_time,
                    active: Boolean(inserted.active)
                });
            }

            setDriverVehicleSessions(activeSessions.filter(session => session.active));
        } catch (error) {
            console.warn('Erro no sync automático de sessões motorista/viatura:', error);
        }
    };

    const runComplianceCheck = async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        console.log("Iniciando verificação de conformidade...");

        const newStats: Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }> = {};

        // 1. Filter active services with drivers
        const activeServices = servicos.filter(s => s.motoristaId && !s.concluido);

        for (const service of activeServices) {
            // Find driver and vehicle
            const driver = motoristas.find(m => m.id === service.motoristaId);
            if (!driver) {
                newStats[service.id] = { status: 'pending', message: 'Motorista não encontrado' };
                continue;
            }

            // Determine vehicle ID (either from current assignment or Cartrack link)
            let vehicleId = driver.cartrackId;

            // If explicit cartrackId not found, try to find via currentVehicle plate
            if (!vehicleId && driver.currentVehicle) {
                const cv = cartrackVehicles.find(v =>
                    v.registration.replace(/[^a-zA-Z0-9]/g, '') === driver.currentVehicle?.replace(/[^a-zA-Z0-9]/g, '')
                );
                if (cv) vehicleId = cv.id;
            }

            // --- NEW: LIVE POI CHECK ---
            // Try to find if the Service Origin/Destination matches a known POI (Local)
            // Logic: Check 'Origem' for 'Entrada' services, 'Destino' for 'Saída', or both.
            const targetLocationName = service.obs === 'Saída' ? service.destino : service.origem;

            // Find matching Local (POI)
            // Loose matching: POI name contained in Service location or vice versa
            const targetPOI = locais.find(l =>
                l.nome.toLowerCase().includes(targetLocationName.toLowerCase()) ||
                targetLocationName.toLowerCase().includes(l.nome.toLowerCase())
            );

            // Find LIVE Vehicle Object (for coordinates)
            const liveVehicle = cartrackVehicles.find(v =>
                (vehicleId && v.id === String(vehicleId)) ||
                (driver.currentVehicle && v.registration.replace(/\s+/g, '') === driver.currentVehicle.replace(/\s+/g, ''))
            );

            if (targetPOI && liveVehicle) {
                // Calculate Distance
                const dist = calculateDistance(liveVehicle.latitude, liveVehicle.longitude, targetPOI.latitude, targetPOI.longitude);
                const radius = targetPOI.raio || 200; // Default 200m if not set

                if (dist <= radius) {
                    newStats[service.id] = {
                        status: 'success',
                        message: `✓ Em Local: ${targetPOI.nome} (${Math.round(dist)}m)`
                    };
                    continue; // Success found, skip legacy check
                } else {
                    // Too far currently
                    // Don't fail immediately, fallback to Geofence History check below
                    // or set a provisional 'away' message if history check also fails
                }
            }


            if (!vehicleId) {
                newStats[service.id] = { status: 'pending', message: `Viatura não associada (${driver.currentVehicle || 'N/A'})` };
                continue;
            }

            try {
                // Fetch visits for this vehicle (Optimized: only if we have a vehicle)
                const now = new Date();
                const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();
                const visits = await CartrackService.getGeofenceVisits({ 
                    vehicleId, 
                    startTime: startOfDay, 
                    endTime: endOfDay 
                });

                // DATA DE HOJE (Filtering visits for today in UTC/Local approximation)
                // Visits usually come in UTC or API time. Just string matching YYYY-MM-DD for simplicity first.
                // Improve later if Timezone issues arise.
                const todayVisits = visits.filter(v => v.entryTime && v.entryTime.includes(todayStr));

                // MATCHING LOGIC
                // 1. Origin
                const originMatch = todayVisits.find(v =>
                    v.geofenceName.toLowerCase().includes(service.origem.toLowerCase()) ||
                    service.origem.toLowerCase().includes(v.geofenceName.toLowerCase())
                );

                // 2. Destination
                const destMatch = todayVisits.find(v =>
                    v.geofenceName.toLowerCase().includes(service.destino.toLowerCase()) ||
                    service.destino.toLowerCase().includes(v.geofenceName.toLowerCase())
                );

                // TIME VALIDATION (Simple: +/- 45 mins)
                // Parse service time
                const [sh, sm] = service.hora.split(':').map(Number);
                const serviceTimeMinutes = sh * 60 + sm;

                // Helper check
                const checkTime = (visit: any) => {
                    const visitTime = new Date(visit.entryTime); // Assuming ISO
                    const visitMinutes = visitTime.getHours() * 60 + visitTime.getMinutes();
                    return Math.abs(visitMinutes - serviceTimeMinutes);
                };

                let status: 'success' | 'failed' | 'pending' = 'pending';
                let message = '';

                // If it's an "Entrada", we care about Origin pickup. If "Saída", Destination dropoff.
                // Or user might want BOTH. User said: "PASSAREM NA GEOFENCE DO PONTO DE RECOLHA E DESTINO" (AND).
                // But usually service is A -> B. 
                // Let's assume for now checks BOTH if defined.

                const targetGeofenceName = service.obs === 'Saída' ? service.destino : service.origem;
                const match = service.obs === 'Saída' ? destMatch : originMatch;

                if (match) {
                    const diff = checkTime(match);
                    if (diff <= 60) { // 60 min tolerance (traffic etc)
                        status = 'success';
                        message = `✓ ${match.geofenceName} (${Math.round(diff)}m)`;
                    } else {
                        status = 'failed';
                        message = `🕒 Fora de horas (${match.geofenceName})`;
                    }
                } else {
                    // Fallback from Live Check
                    if (targetPOI && liveVehicle) {
                        // If we are here, it means Live Check failed (vehicle far) AND Geofence History failed
                        const dist = calculateDistance(liveVehicle.latitude, liveVehicle.longitude, targetPOI.latitude, targetPOI.longitude);
                        status = 'failed';
                        message = `📍 ${Math.round(dist / 1000)}km de ${targetPOI.nome}`;
                    } else {
                        status = 'failed';
                        message = `📍 Falha Geofence: ${targetGeofenceName}`;
                    }
                }

                newStats[service.id] = { status, message };

            } catch (e) {
                console.error(`Erro validacao servico ${service.id}`, e);
                newStats[service.id] = { status: 'pending', message: 'Erro na API' };
            }
        }

        setComplianceStats(newStats);
    };

    const runComplianceDemo = () => {
        const newStats: Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }> = {};
        const activeServices = servicos.filter(s => s.motoristaId && !s.concluido).slice(0, 5); // Take first 5

        if (activeServices.length > 0) newStats[activeServices[0].id] = { status: 'success', message: 'Validado em Aeroporto' };
        if (activeServices.length > 1) newStats[activeServices[1].id] = { status: 'failed', message: 'Falha na Origem: Garagem' };
        if (activeServices.length > 2) newStats[activeServices[2].id] = { status: 'failed', message: 'Horário incorreto (55 min)' };
        if (activeServices.length > 3) newStats[activeServices[3].id] = { status: 'success', message: 'Validado em H. Tivoli' };

        setComplianceStats(newStats);
    };

    // NEW: Fuel Management State
    const [fuelTank, setFuelTank] = useState<FuelTank>({
        id: 'main',
        capacity: 6000,
        currentLevel: 6000,
        pumpTotalizer: 0,
        lastRefillDate: new Date().toISOString(),
        averagePrice: 0
    });

    // NEW: Manual Hours State
    const [manualHours, setManualHours] = useState<ManualHourRecord[]>([]);

    const [fuelTransactions, setFuelTransactions] = useState<FuelTransaction[]>([]);
    const [tankRefills, setTankRefills] = useState<TankRefillLog[]>([]);
    const [rotasPlaneadas, setRotasPlaneadas] = useState<RotaPlaneada[]>([]);
    const [logsOperacionais, setLogsOperacionais] = useState<LogOperacional[]>([]);

    const refreshData = async () => {
        try {
            setCartrackError(null);
            setDbConnectionError(null);

            let loadedViaturas: any[] = [];
            const normalizePlateRef = (plate?: string | null) => (plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const resolveVehicleIdFromLegacyRef = (value: any) => {
                if (!value) return undefined;
                const candidate = String(value);
                const byId = loadedViaturas.find(v => v.id === candidate);
                if (byId) return byId.id;

                const normalized = normalizePlateRef(candidate);
                const byPlate = loadedViaturas.find(v => normalizePlateRef(v.matricula) === normalized);
                return byPlate?.id;
            };

            // 1. Core Data
            try {
                const { data: zo } = await supabase.from('zonas_operacionais').select('*');
                if (zo) setZonasOperacionais(zo);
            } catch (e) {
                console.error('Error fetching zonas_operacionais:', e);
            }

            try {
                const { data: ao } = await supabase.from('areas_operacionais').select('*');
                if (ao) setAreasOperacionais(ao);
            } catch (e) {
                console.error('Error fetching areas_operacionais:', e);
            }


            try {
                const { data: f, error } = await supabase.from('fornecedores').select('*');
                if (error) throw error;
                if (f) setFornecedores(f);
            } catch (e: any) {
                console.error('Error fetching fornecedores:', e);
                setDbConnectionError(`Erro Conexão (Fornecedores): ${e.message || 'Desconhecido'}`);
            }

            try {
                const { data: c, error } = await supabase.from('clientes').select('*');
                if (error) throw error;
                if (c) setClientes(c);
            } catch (e: any) {
                console.error('Error fetching clientes:', e);
                setDbConnectionError(`Erro Conexão (Clientes): ${e.message || 'Desconhecido'}`);
            }

            // POIs
            try {
                const { data: loc, error } = await supabase.from('locais').select('*');
                if (error) throw error;
                if (loc) setLocais(loc.map((l: any) => ({ ...l, userId: l.user_id })));
            } catch (e: any) {
                console.error('Error fetching locais:', e);
                setDbConnectionError(`Erro Conexão (Locais): ${e.message || 'Desconhecido'}`);
            }

            try {
                const { data: v, error } = await supabase.from('viaturas').select('*');
                if (error) throw error;
                if (v) {
                    loadedViaturas = v;
                    setViaturas(v.map((item: any) => ({
                        ...item,
                        precoDiario: item.preco_diario,
                        vehicleCapacity: Number(item.vehicle_capacity || 8)
                    })));
                }
            } catch (e: any) {
                console.error('Error fetching viaturas:', e);
                setDbConnectionError(`Erro Conexão (Viaturas): ${e.message || 'Desconhecido'}`);
            }

            try {
                const { data: cc, error } = await supabase.from('centros_custos').select('*');
                if (error) throw error;
                if (cc) setCentrosCustos(cc.map((item: any) => ({ ...item, id: item.id, nome: item.nome, localizacao: item.localizacao, codigo: item.codigo })));
            } catch (e: any) {
                console.error('Error fetching centros_custos:', e);
                setDbConnectionError(`Erro Conexão (Centros de Custo): ${e.message || 'Permissão Negada'}`);
            }

            try {
                const { data: r, error } = await supabase.from('requisicoes').select('*');
                if (error) throw error;
                if (r) setRequisicoes(
                    r.map((item: any) => {
                        let parsedFaturas: any[] = [];

                        try {
                            if (item.faturas_dados) {
                                let temp = item.faturas_dados;
                                // First Parse
                                if (typeof temp === 'string') {
                                    temp = JSON.parse(temp);
                                }
                                // Second Parse (Double encoding fix)
                                if (typeof temp === 'string') {
                                    temp = JSON.parse(temp);
                                }
                                parsedFaturas = Array.isArray(temp) ? temp : [];
                            }
                        } catch (e) {
                            console.warn("Error parsing faturas_dados for req", item.numero, e);
                            parsedFaturas = [];
                        }

                        return {
                            ...item,
                            itens: item.itens || [],
                            numero: String(item.numero),
                            clienteId: item.cliente_id,
                            fornecedorId: item.fornecedor_id,
                            viaturaId: item.viatura_id || resolveVehicleIdFromLegacyRef(item.vehicle_id) || resolveVehicleIdFromLegacyRef(item.license_plate) || resolveVehicleIdFromLegacyRef(item.matricula),
                            centroCustoId: item.centro_custo_id,
                            criadoPor: item.criado_por,
                            financial_status: item.financial_status,
                            erp_status: item.erp_status,
                            total_invoiced_amount: item.total_invoiced_amount,
                            approved_value: item.approved_value,
                            custo: item.custo,
                            faturas_dados: parsedFaturas,
                            supplier_confirmed: item.supplier_confirmed,
                            supplier_confirmed_at: item.supplier_confirmed_at || (item.supplier_confirmed ? item.supplier_response_date : null),
                            supplier_refused: item.supplier_refused ?? item.supplier_rejected,
                            supplier_refused_at: item.supplier_refused_at || ((item.supplier_refused ?? item.supplier_rejected) ? item.supplier_response_date : null),
                            supplier_rejected: item.supplier_rejected ?? item.supplier_refused,
                            supplier_comment: item.supplier_comment,
                            supplier_response_date: item.supplier_response_date
                        };
                    })
                );

            } catch (e: any) {
                console.error('Error fetching requisicoes:', e);
                // Don't override previous critical error if found
            }

            try {
                const { data: av, error } = await supabase.from('avaliacoes').select('*');
                if (error) throw error;
                if (av) setAvaliacoes(av.map((item: any) => ({
                    id: item.id,
                    motoristaId: item.motorista_id,
                    adminId: item.admin_id,
                    periodo: item.periodo,
                    pontuacao: item.pontuacao,
                    criterios: item.criterios,
                    obs: item.obs,
                    dataAvaliacao: item.data_avaliacao
                })));
            } catch (e: any) {
                console.error('Error fetching avaliacoes:', e);
            }

            try {
                const { data: metrics, error } = await supabase.from('metricas_viatura').select('*');
                if (error) throw error;
                if (metrics) setVehicleMetrics(metrics.map((m: any) => ({
                    vehicleId: m.vehicle_id,
                    consumoMedio: m.consumo_medio,
                    totalLitrosMes: m.total_litros_mes,
                    totalCustoMes: m.total_custo_mes,
                    ultimaKm: m.ultima_km,
                    estimativaAutonomia: m.estimativa_autonomia,
                    updatedAt: m.updated_at
                })));
            } catch (e: any) {
                console.error('Error fetching vehicle metrics:', e);
            }

            try {
                const { data: rp } = await supabase.from('rotas_planeadas').select('*').order('created_at', { ascending: false });
                if (rp) setRotasPlaneadas(rp);

                const { data: logs } = await supabase.from('logs_operacionais').select('*').order('data_hora', { ascending: false }).limit(500);
                if (logs) setLogsOperacionais(logs);
            } catch (e: any) {
                console.error('Error fetching routing/logs:', e);
            }

            try {
                const { data: templates } = await supabase.from('escala_templates').select('*');
                if (templates) setEscalaTemplates(templates.map((t: any) => ({
                    id: t.id,
                    nome: t.nome,
                    centro_custo_id: t.centro_custo_id,
                    created_at: t.created_at,
                    created_by: t.created_by
                })));

                const { data: tItems } = await supabase.from('escala_template_items').select('*');
                if (tItems) setEscalaTemplateItems(tItems.map((ti: any) => ({
                    id: ti.id,
                    template_id: ti.template_id,
                    hora_entrada: ti.hora_entrada,
                    hora_saida: ti.hora_saida,
                    passageiro: ti.passageiro,
                    local: ti.local,
                    referencia: ti.referencia,
                    obs: ti.obs,
                    created_at: ti.created_at
                })));
            } catch (e) {
                console.error('Error fetching scale templates:', e);
            }

            // Workshop Stock
            try {
                const stockTable = await resolveStockItemsTable();
                const { data: items } = await supabase.from(stockTable).select('*, supplier:fornecedores(*)');
                const normalizedItemsRaw = (items || []) as import('../types').StockItem[];

                const { data: movements } = await supabase
                    .from('stock_movements')
                    .select('*')
                    .order('created_at', { ascending: false });

                const requisitionItemIds = new Set(
                    (movements || [])
                        .filter((movement: any) => movement.source_document === 'requisition')
                        .map((movement: any) => String(movement.item_id))
                );

                const normalizedItems = normalizedItemsRaw.filter(item => {
                    if (isRequisitionCategory(item.category)) return false;
                    if (requisitionItemIds.has(String(item.id))) return false;
                    return true;
                });

                setStockItems(normalizedItems);

                if (movements) {
                    const itemById = new Map(normalizedItems.map(item => [String(item.id), item]));
                    const visibleMovements = movements.filter((movement: any) => {
                        if (movement.source_document === 'requisition') return false;
                        if (requisitionItemIds.has(String(movement.item_id))) return false;
                        return true;
                    });

                    const enriched = visibleMovements.map((movement: any) => ({
                        ...movement,
                        item: itemById.get(String(movement.item_id))
                    }));
                    setStockMovements(enriched);
                }

                const { data: assets } = await supabase.from('workshop_assets').select('*');
                if (assets) setWorkshopAssets(assets);
            } catch (e) {
                console.error('Error fetching inventory data:', e);
            }

            // 2. Eva Transports
            const { data: transports } = await supabase.from('eva_transports').select('*');
            const { data: days } = await supabase.from('eva_transport_days').select('*');
            if (transports) {
                const combined = transports.map((t: any) => ({
                    id: t.id,
                    referenceDate: t.reference_date,
                    route: t.route,
                    amount: t.amount,
                    notes: t.notes,
                    loggedBy: t.logged_by,
                    createdAt: t.created_at,
                    days: days?.filter((d: any) => d.transport_id === t.id).map((d: any) => ({
                        id: d.id,
                        date: d.date,
                        hasIssue: d.has_issue,
                        issueType: d.issue_type,
                        issueDescription: d.issue_description,
                        issueSeverity: d.issue_severity
                    })) || []
                }));
                setEvaTransports(combined);
            }

            // 3. Team
            // 3. Team - DECOUPLED FETCH FOR SAFETY
            // Always fetch DB Motoristas first to ensure Admin panel is never empty
            const normalizePlate = (p?: string | null) => p?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '';
            const { data: dbMotoristas, error: dbMotoristasError } = await supabase.from('motoristas').select('*');
            if (dbMotoristasError) console.error('Error fetching motoristas:', dbMotoristasError);

            // 3.1 Fetch Locais & Geofence Mappings early for enrichment
            const { data: dbLocais } = await supabase.from('locais').select('*');
            const { data: geoMappings } = await supabase.from('cartrack_geofence_mappings').select('*');

            if (geoMappings) {
                const map: Record<string, string> = {};
                geoMappings.forEach((m: any) => { map[m.geofence_name] = m.centro_custo_id; });
                setGeofenceMappings(map);
            }
            const currentLocais = dbLocais?.map((l: any) => ({
                id: l.id,
                nome: l.nome,
                latitude: l.latitude,
                longitude: l.longitude,
                raio: l.raio,
                tipo: l.tipo,
                cor: l.cor,
                centroCustoId: l.centro_custo_id
            })) || [];
            setLocais(currentLocais);

            let updatedMotoristas: Motorista[] = [];
            let cDrivers: any[] = [];
            let cVehicles: any[] = [];

            if (dbMotoristas) {
                // Initialize with DB data (safe baseline)
                updatedMotoristas = dbMotoristas.map((m: any) => ({
                    ...m,
                    vencimentoBase: m.vencimento_base,
                    valorHora: m.valor_hora,
                    dataRegisto: m.data_registo,
                    cartaConducao: m.carta_conducao,
                    blockedPermissions: m.blocked_permissions,
                    turnoInicio: m.turno_inicio,
                    turnoFim: m.turno_fim,
                    cartrackKey: m.cartrack_key,
                    cartrackId: m.cartrack_id,
                    currentVehicle: m.current_vehicle,
                    centroCustoId: m.centro_custo_id,
                    status: m.status || 'disponivel',
                    shifts: m.shifts || [],
                    zones: m.zones || ['albufeira', 'quarteira'],
                    blockedPeriods: m.blocked_periods || [],
                    maxDailyServices: m.max_daily_services,
                    minIntervalMinutes: m.min_interval_minutes || 30,
                    tipoUtilizador: m.tipo_utilizador || 'motorista',
                    estadoOperacional: m.estado_operacional || 'disponivel'
                }));

                // Attempt Cartrack Enrichment (Safe Mode)
                try {
                    const [driversResult, vehiclesResult, geofencesResult] = await Promise.allSettled([
                        CartrackService.getDrivers(),
                        CartrackService.getVehicles(),
                        CartrackService.getGeofences()
                    ]);

                    if (driversResult.status === 'fulfilled') cDrivers = driversResult.value;
                    else console.warn('Cartrack Drivers fetch failed:', driversResult.reason);

                    if (vehiclesResult.status === 'fulfilled') cVehicles = vehiclesResult.value;
                    else {
                        console.warn('Cartrack Vehicles fetch failed:', vehiclesResult.reason);
                        setCartrackError(`Falha na Cartrack: ${vehiclesResult.reason?.message || 'Erro de conexão'}`);
                    }

                    if (geofencesResult.status === 'fulfilled') {
                        setGeofences(geofencesResult.value);
                    } else {
                        console.warn('Cartrack Geofences fetch failed:', geofencesResult.reason);
                    }

                    // If Cartrack succeeded, perform enrichment
                    if (cDrivers && cVehicles) {
                        const enriched = await Promise.all(dbMotoristas.map(async (m: any) => {
                            // 1. Try to find missing cartrackId by matching cartrackKey OR Name
                            let currentCartrackId = m.cartrack_id;
                            if (!currentCartrackId) {
                                // Match by tag first
                                const matchedCDriver = cDrivers.find(cd => cd.tagId && m.cartrack_key && cd.tagId === m.cartrack_key);
                                if (matchedCDriver) {
                                    currentCartrackId = matchedCDriver.id;
                                    await supabase.from('motoristas').update({ cartrack_id: matchedCDriver.id }).eq('id', m.id);
                                } else {
                                    // Match by fuzzy name if tag failed
                                    const matchedByName = cDrivers.find(cd => isNameMatch(cd.fullName, m.nome));
                                    if (matchedByName) {
                                        currentCartrackId = matchedByName.id;
                                        // Also update tag if available and missing locally
                                        const updatePayload: any = { cartrack_id: matchedByName.id };
                                        if (matchedByName.tagId && !m.cartrack_key) {
                                            updatePayload.cartrack_key = matchedByName.tagId;
                                        }
                                        await supabase.from('motoristas').update(updatePayload).eq('id', m.id);
                                    }
                                }
                            }

                            // 2. Active Vehicle Status (Enhanced Matching)
                            const activeVehicle = cVehicles.find(v => {
                                const vTagClean = cleanTagId(v.tagId);
                                const mTagClean = cleanTagId(m.cartrack_key);
                                
                                const idMatch = currentCartrackId && String(v.driverId) === String(currentCartrackId);
                                const nameMatch = isNameMatch(v.driverName, m.nome);
                                const tagMatch = vTagClean && mTagClean && vTagClean === mTagClean;
                                const plateMatch = m.current_vehicle && normalizePlate(v.registration) === normalizePlate(m.current_vehicle);
                                
                                // NEW: Extra loose matching for "tag with same name" cases
                                const nameInTagMatch = v.tagId && isNameMatch(v.tagId, m.nome);
                                
                                if (idMatch || nameMatch || tagMatch || plateMatch || nameInTagMatch) {
                                    if (m.nome.toLowerCase().includes('marco')) {
                                        console.log(`[DEBUG] Found match for ${m.nome}: ${v.registration} (ID:${idMatch}, Name:${nameMatch}, Tag:${tagMatch}, Plate:${plateMatch}, NameInTag:${nameInTagMatch})`);
                                    }
                                    return true;
                                }
                                
                                if (m.nome.toLowerCase().includes('marco')) {
                                   // console.log(`[DEBUG] No match for ${m.nome} against ${v.registration} (Status: ${v.status}, DriverName: ${v.driverName}, TagId: ${v.tagId})`);
                                }
                                return false;
                            });

                            // PERSIFTENCE: If we detected a NEW vehicle via Cartrack that differs from DB, save it!
                            if (activeVehicle && activeVehicle.registration !== m.current_vehicle) {
                                console.log(`[Auto-Sync] Updating vehicle for ${m.nome}: ${activeVehicle.registration}`);
                                // Fire and forget update to avoid blocking UI
                                supabase.from('motoristas')
                                    .update({ current_vehicle: activeVehicle.registration })
                                    .eq('id', m.id)
                                    .then(({ error }) => {
                                        if (error) console.error('Failed to persist auto-detected vehicle:', error);
                                    });
                            }

                            return {
                                ...m,
                                vencimentoBase: m.vencimento_base,
                                valorHora: m.valor_hora,
                                dataRegisto: m.data_registo,
                                cartaConducao: m.carta_conducao,
                                blockedPermissions: m.blocked_permissions,
                                turnoInicio: m.turno_inicio,
                                turnoFim: m.turno_fim,
                                cartrackKey: m.cartrack_key,
                                cartrackId: currentCartrackId,
                                currentVehicle: activeVehicle?.registration || m.current_vehicle,
                                status: activeVehicle ? 'ocupado' : (m.status || 'disponivel')
                            };
                        }));
                        updatedMotoristas = enriched as Motorista[];
                    }
                } catch (cartrackErr) {
                    console.warn('Cartrack enrichment failed - showing basic driver list:', cartrackErr);
                }

                // Enrich Cartrack Vehicles with local data or Cartrack Driver List fallback
                console.log('Enriching vehicles:', cVehicles.length, 'drivers:', cDrivers.length);
                const detectedSessionAssignments: Array<{ driverId: string; vehicleId: string; moving: boolean; timestamp: string }> = [];
                const enrichedVehicles = cVehicles.map(v => {
                    let resolvedName = v.driverName;

                    const isProperName = (name?: string | null) => {
                        if (!name || name === 'N/A' || name === 'Sem Motorista') return false;
                        return normalizePlate(name) !== normalizePlate(v.registration);
                    };

                    if (!isProperName(resolvedName) && (v.driverId || v.tagId)) {
                        const cd = cDrivers.find(d =>
                            (v.driverId && String(d.id) === String(v.driverId)) ||
                            (v.tagId && d.tagId === v.tagId)
                        );

                        if (cd) {
                            resolvedName = cd.fullName;
                        }
                    }

                    // 2. Try to find local motorista for better naming/keys
                    const localM = updatedMotoristas.find(m =>
                        (m.cartrackId && String(m.cartrackId) === String(v.driverId)) ||
                        (m.cartrackKey && v.tagId && m.cartrackKey === v.tagId) ||
                        (m.currentVehicle && normalizePlate(m.currentVehicle) === normalizePlate(v.registration))
                    );

                    let displayName = 'Sem Motorista';

                    // Only show Cartrack driver if vehicle is moving/idle OR has an active tag swipe
                    const shouldShowCartrackDriver = v.status !== 'stopped' || !!v.tagId;

                    if (localM) {
                        displayName = localM.nome;
                    } else if (shouldShowCartrackDriver && isProperName(resolvedName)) {
                        displayName = resolvedName!;
                    }

                    if (localM) {
                        detectedSessionAssignments.push({
                            driverId: localM.id,
                            vehicleId: String(v.id),
                            moving: Boolean((v.status && v.status !== 'stopped') || Number(v.speed || 0) > 0),
                            timestamp: v.last_position_update || new Date().toISOString()
                        });
                    }

                    // 3. Detect current Cost Center from POIs (Locais)
                    let currentCCId: string | undefined = undefined;
                    let currentCCName: string | undefined = undefined;

                    if (v.latitude && v.longitude) {
                        // Prioritize smallest radius (smallest matches win)
                        const matchingLocals = currentLocais.filter(l =>
                            l.centroCustoId && getDistance(v.latitude, v.longitude, l.latitude, l.longitude) <= l.raio
                        ).sort((a, b) => a.raio - b.raio);

                        const matchingLocal = matchingLocals[0];

                        if (matchingLocal) {
                            currentCCId = matchingLocal.centroCustoId;
                            currentCCName = matchingLocal.nome;
                        }

                        // NEW: Also check direct geofence mapping from Cartrack (if present in vehicle object)
                        if (!currentCCId && v.currentGeofenceName && geofenceMappings[v.currentGeofenceName]) {
                            currentCCId = geofenceMappings[v.currentGeofenceName];
                            const cc = centrosCustos.find(c => c.id === currentCCId);
                            currentCCName = cc?.nome || v.currentGeofenceName;
                        }
                    }

                    return {
                        ...v,
                        driverName: displayName,
                        currentCentroCustoId: currentCCId,
                        currentCentroCustoName: currentCCName
                    };
                });

                setMotoristas(updatedMotoristas);
                setCartrackVehicles(enrichedVehicles);
                await syncDriverVehicleSessions(detectedSessionAssignments);

                // FINAL SAFETY: Merge tags found in vehicles into the drivers list
                // This handles cases where a tag is known to the system (swiped in a car) 
                // but not explicitly linked to a "Driver" object in the API
                const finalDrivers = [...cDrivers];
                const existingDriverTags = new Set(cDrivers.map(d => d.tagId?.toUpperCase()).filter(Boolean));

                cVehicles.forEach(v => {
                    if (v.tagId && !existingDriverTags.has(v.tagId.toUpperCase())) {
                        const cleanTag = v.tagId.toUpperCase();
                        finalDrivers.push({
                            id: `vehicle-tag-${cleanTag}`,
                            firstName: 'Motorista',
                            lastName: 'Viatura',
                            fullName: `Motorista (Tag ${cleanTag.slice(-6)})`,
                            tagId: cleanTag,
                            tagVariants: getTagVariants(cleanTag)
                        } as any);
                        existingDriverTags.add(cleanTag);
                    }
                });

                setCartrackDrivers(finalDrivers);
            } else {
                setCartrackVehicles(cVehicles);
                setCartrackDrivers(cDrivers);
            }

            // 4. Other Teams - Fetched Independently for Safety
            try {
                const { data: sups, error } = await supabase.from('supervisores').select('*');
                if (error) throw error;
                console.log(`[DEBUG] Supervisores fetched: ${sups?.length || 0}`, sups); // DEBUG LOG
                if (sups) setSupervisors(sups.map((s: any) => ({ ...s, password: s.password, blockedPermissions: s.blocked_permissions, dataRegisto: s.data_registo })));
            } catch (supErr: any) {
                console.error('Error fetching supervisors:', supErr);
                setDbConnectionError(`Erro Supervisores: ${supErr.message || 'Desconhecido'}`);
            }

            try {
                const { data: managers, error } = await supabase.from('gestores').select('*');
                if (error) throw error;
                console.log(`[DEBUG] Gestores fetched: ${managers?.length || 0}`, managers); // DEBUG LOG
                if (managers) setGestores(managers.map((g: any) => ({ ...g, blockedPermissions: g.blocked_permissions, dataRegisto: g.data_registo })));
            } catch (gestErr: any) {
                console.error('Error fetching gestores:', gestErr);
                setDbConnectionError(`Erro Gestores: ${gestErr.message || 'Desconhecido'}`);
            }

            try {
                const { data: oficina, error } = await supabase.from('oficina_users').select('*');
                if (error) throw error;
                console.log(`[DEBUG] Oficina fetched: ${oficina?.length || 0}`, oficina); // DEBUG LOG
                if (oficina) setOficinaUsers(oficina.map((u: any) => ({ ...u, blockedPermissions: u.blocked_permissions, dataRegisto: u.data_registo })));
            } catch (ofiErr: any) {
                console.error('Error fetching oficina users:', ofiErr);
                setDbConnectionError(`Erro Oficina: ${ofiErr.message || 'Desconhecido'}`);
            }

            // 4. Notifications & Services
            const { data: notifs } = await supabase.from('notifications').select('*');
            if (notifs) setNotifications(notifs.map((n: any) => ({ ...n, data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data, response: typeof n.response === 'string' ? JSON.parse(n.response) : n.response })));

            if (supportsDriverVehicleSessionsTableRef.current) {
                const { data: sessionsData, error: sessionsError } = await supabase
                    .from('driver_vehicle_sessions')
                    .select('*')
                    .eq('active', true)
                    .order('start_time', { ascending: false });

                if (sessionsError) {
                    if (isMissingDriverVehicleSessionsTableError(sessionsError)) {
                        supportsDriverVehicleSessionsTableRef.current = false;
                    } else {
                        console.warn('Erro ao carregar sessões motorista/viatura:', sessionsError);
                    }
                } else {
                    const mappedSessions = (sessionsData || []).map((session: any) => ({
                        id: session.id,
                        driverId: session.driver_id,
                        vehicleId: session.vehicle_id,
                        startTime: session.start_time,
                        endTime: session.end_time,
                        active: Boolean(session.active)
                    } as DriverVehicleSession));

                    setDriverVehicleSessions(mappedSessions);
                }
            }

            let eventsByServiceId = new Map<string, ServiceEvent[]>();
            if (supportsServiceEventsTableRef.current) {
                const { data: rawEvents, error: eventsError } = await supabase
                    .from('service_events')
                    .select('*')
                    .order('timestamp', { ascending: true });

                if (eventsError) {
                    const message = String(eventsError?.message || eventsError?.details || '').toLowerCase();
                    if (message.includes('service_events') && (message.includes('does not exist') || message.includes('schema cache'))) {
                        supportsServiceEventsTableRef.current = false;
                    } else {
                        console.warn('Error fetching service events:', eventsError);
                    }
                } else {
                    const mapped = (rawEvents || []).map((event: any) => ({
                        id: event.id,
                        serviceId: event.service_id,
                        vehicleId: event.vehicle_id,
                        eventType: event.event_type,
                        timestamp: event.timestamp,
                        locationId: event.location_id,
                        metadata: event.metadata
                    } as ServiceEvent));

                    setServiceEvents(mapped);

                    eventsByServiceId = mapped.reduce((acc, event) => {
                        const serviceId = String(event.serviceId || '');
                        if (!serviceId) return acc;
                        const current = acc.get(serviceId) || [];
                        current.push(event);
                        acc.set(serviceId, current);
                        return acc;
                    }, new Map<string, ServiceEvent[]>());
                }
            }

            const { data: servs, error: servError } = await supabase.from('servicos').select('*');
            if (servError) console.error('Error fetching services:', servError);
            if (servs) {
                console.log('Fetched services:', servs.length);
                setServicos(servs.map((s: any) => {
                    const destinationConfirmed = Boolean(s.destination_confirmed);
                    const completed = Boolean(s.concluido) || destinationConfirmed || Boolean(s.destination_arrival_time);
                    const lifecycleStatus = deriveServiceLifecycleStatus({
                        motoristaId: s.motorista_id,
                        serviceDate: s.data,
                        serviceHour: s.hora,
                        originConfirmed: Boolean(s.origin_confirmed || s.origin_arrival_time),
                        originDepartureTime: s.origin_departure_time,
                        destinationConfirmed
                    });

                    return {
                        ...s,
                        motoristaId: s.motorista_id,
                        centroCustoId: s.centro_custo_id,
                        status: coerceServiceStatus(s.status) || lifecycleStatus,
                        concluido: completed,
                        failureReason: s.failure_reason,
                        batchId: s.batch_id,
                        tipo: s.tipo,
                        departamento: s.departamento,
                        isUrgent: Boolean(s.is_urgent) || s.status === 'URGENTE',
                        vehicleId: s.vehicle_id || null,
                        passengerCount: Number(s.passenger_count || 1),
                        occupancyRate: s.occupancy_rate !== null && s.occupancy_rate !== undefined ? Number(s.occupancy_rate) : null,
                        originLocationId: s.origem_location_id,
                        destinationLocationId: s.destino_location_id,
                        originArrivalTime: s.origin_arrival_time,
                        destinationArrivalTime: s.destination_arrival_time,
                        originConfirmed: Boolean(s.origin_confirmed),
                        destinationConfirmed,
                        originDepartureTime: s.origin_departure_time,
                        destinationDepartureTime: s.destination_departure_time,
                        originStopDurationSeconds: s.origin_arrival_time && s.origin_departure_time
                            ? Math.max(0, Math.round((new Date(s.origin_departure_time).getTime() - new Date(s.origin_arrival_time).getTime()) / 1000))
                            : null,
                        serviceEvents: eventsByServiceId.get(s.id) || []
                    };
                }));
            }

            const { data: batches, error: batchError } = await supabase.from('scale_batches').select('*');
            if (batchError) console.error('Error fetching batches:', batchError);
            if (batches) {
                console.log('[DEBUG] Scale Batches Fetched:', batches.length);
                setScaleBatches(batches);
            }

            // 5. Fuel
            const { data: tankData } = await supabase.from('fuel_tank').select('*').eq('id', 'main').single();
            if (tankData) setFuelTank({
                id: tankData.id,
                capacity: tankData.capacity,
                currentLevel: tankData.current_level,
                pumpTotalizer: tankData.pump_totalizer,
                lastRefillDate: tankData.last_refill_date,
                averagePrice: tankData.average_price,
                baselineDate: tankData.baseline_date,
                baselineLevel: tankData.baseline_level,
                baselineTotalizer: tankData.baseline_totalizer
            });

            const { data: transData } = await supabase.from('fuel_transactions').select('*');
            if (transData) setFuelTransactions(transData.map((t: any) => ({
                ...t,
                driverId: t.driver_id,
                vehicleId: resolveVehicleIdFromLegacyRef(t.vehicle_id) || t.vehicle_id,
                staffId: t.staff_id,
                staffName: t.staff_name,
                pumpCounterAfter: t.pump_counter_after,
                pricePerLiter: t.price_per_liter,
                totalCost: t.total_cost,
                centroCustoId: t.centro_custo_id,
                isExternal: t.is_external
            })));

            const { data: refillData } = await supabase.from('tank_refills').select('*');
            if (refillData) setTankRefills(refillData.map((r: any) => ({ ...r, litersAdded: r.liters_added, levelBefore: r.level_before, levelAfter: r.level_after, totalSpentSinceLast: r.total_spent_since_last, pumpMeterReading: r.pump_meter_reading, systemExpectedReading: r.system_expected_reading, staffId: r.staff_id, staffName: r.staff_name, pricePerLiter: r.price_per_liter, totalCost: r.total_cost })));

            // 6. Admin Users (Only if admin)
            const { data: admins } = await supabase.from('admin_users').select('*');
            if (admins) setAdminUsers(admins.map((a: any) => ({
                id: a.id,
                email: a.email,
                nome: a.nome,
                role: a.role,
                createdAt: a.created_at
            })));

            if (admins) setAdminUsers(admins.map((a: any) => ({
                id: a.id,
                email: a.email,
                nome: a.nome,
                role: a.role,
                createdAt: a.created_at
            })));

            // 7. Manual Hours
            const { data: mh } = await supabase.from('manual_hours').select('*');
            if (mh) setManualHours(mh.map((item: any) => ({
                id: item.id,
                motoristaId: item.motorista_id,
                adminId: item.admin_id,
                date: item.date,
                startTime: item.start_time,
                endTime: item.end_time,
                breakDuration: item.break_duration,
                obs: item.obs,
                createdAt: item.created_at
            })));

            // 4. Cartrack Geofences
            try {
                const geoData = await CartrackService.getGeofences();
                if (geoData) {
                    setGeofences(geoData);
                    setCartrackError(null);
                }
            } catch (e: any) {
                console.warn('Silent fail: could not fetch Geofences:', e);
                setCartrackError(`Erro Geofences: ${e.message || 'Falha API'}`);
            }

            // 5. Visits (Non-critical)
            try {
                const now = new Date();
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const formatDate = (date: Date) => {
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
                        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
                };
                const visits = await CartrackService.getGeofenceVisits(formatDate(yesterday), formatDate(now));
                if (visits) setGeofenceVisits(visits);
            } catch (e) {
                console.warn('Silent fail: could not fetch Visits:', e);
            }

            // 6. Locais (POIs) - ALREADY FETCHED ABOVE

        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };

    // INITIAL DATA FETCH & AUTH LISTENER
    useEffect(() => {
        // Initial fetch
        refreshData();

        // Listen for Auth Changes to ensure data is re-fetched on login/token refresh
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[WorkshopContext] Auth Event: ${event}`);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                refreshData();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Manual Hours Implementation
    const logServiceHistory = async (servicoId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', previousData: any, newData: any) => {
        try {
            const storedUser = localStorage.getItem('currentUser');
            let user = null;
            if (storedUser) user = JSON.parse(storedUser);

            await supabase.from('servico_history').insert({
                servico_id: servicoId,
                action: action,
                previous_data: previousData,
                new_data: newData,
                changed_by: user?.id || 'system',
                changed_by_name: user?.nome || 'Sistema'
            });
        } catch (err) {
            console.error('Error logging history:', err);
        }
    };

    const addManualHourRecord = async (record: import('../types').ManualHourRecord) => {
        const { error } = await supabase.from('manual_hours').insert({
            id: record.id,
            motorista_id: record.motoristaId,
            admin_id: record.adminId,
            date: record.date,
            start_time: record.startTime,
            end_time: record.endTime,
            break_duration: record.breakDuration,
            obs: record.obs
        });

        if (!error) {
            setManualHours(prev => [...prev, record]);
        } else {
            console.error("Error adding manual hour:", error);
            alert("Erro ao registar hora: " + error.message);
        }
    };

    const deleteManualHourRecord = async (id: string) => {
        const { error } = await supabase.from('manual_hours').delete().eq('id', id);
        if (!error) {
            setManualHours(prev => prev.filter(mh => mh.id !== id));
        } else {
            console.error("Error deleting manual hour:", error);
            alert("Erro ao apagar hora: " + error.message);
        }
    };

    const addServico = async (s: Servico) => {
        try {
            console.log('Adding service to DB:', s);
            const urgent = s.isUrgent ?? isServiceUrgent(s.data, s.hora);
            const completedToPersist = Boolean(s.concluido || s.destinationConfirmed || s.destinationArrivalTime);
            const statusToPersist = normalizeStatusForDb(deriveServiceLifecycleStatus({
                motoristaId: s.motoristaId,
                serviceDate: s.data,
                serviceHour: s.hora,
                originConfirmed: Boolean(s.originConfirmed || s.originArrivalTime),
                originDepartureTime: s.originDepartureTime,
                destinationConfirmed: Boolean(s.destinationConfirmed || s.destinationArrivalTime)
            }));
            const origemLocation = resolveLocationByName(s.origem, s.originLocationId);
            const destinoLocation = resolveLocationByName(s.destino, s.destinationLocationId);
            const basePayload: any = {
                id: s.id,
                motorista_id: s.motoristaId,
                passageiro: s.passageiro,
                hora: s.hora,
                origem: s.origem,
                destino: s.destino,
                voo: s.voo,
                obs: s.obs,
                concluido: completedToPersist,
                centro_custo_id: s.centroCustoId,
                status: statusToPersist,
                failure_reason: s.failureReason
            };

            if (supportsServiceAutoDispatchColumnsRef.current) {
                basePayload.vehicle_id = s.vehicleId || null;
                basePayload.passenger_count = Number(s.passengerCount || 1);
                basePayload.occupancy_rate = s.occupancyRate ?? null;
            }

            if (supportsServiceGeofencingColumnsRef.current) {
                basePayload.origem_location_id = origemLocation?.id || null;
                basePayload.destino_location_id = destinoLocation?.id || null;
                basePayload.origin_arrival_time = s.originArrivalTime || null;
                basePayload.destination_arrival_time = s.destinationArrivalTime || null;
                basePayload.origin_confirmed = Boolean(s.originConfirmed);
                basePayload.destination_confirmed = Boolean(s.destinationConfirmed);
                basePayload.origin_departure_time = s.originDepartureTime || null;
                basePayload.destination_departure_time = s.destinationDepartureTime || null;
            }

            if (supportsUrgentColumnRef.current) {
                basePayload.is_urgent = urgent;
            }

            let payloadToPersist: any = { ...basePayload };

            let { data, error } = await supabase
                .from('servicos')
                .insert(payloadToPersist)
                .select()
                .single();

            if (error && supportsUrgentColumnRef.current && isMissingUrgentColumnError(error)) {
                supportsUrgentColumnRef.current = false;
                const { is_urgent, ...fallbackPayload } = payloadToPersist;
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase
                    .from('servicos')
                    .insert(fallbackPayload)
                    .select()
                    .single());
            }

            if (error && supportsServiceGeofencingColumnsRef.current && isMissingServiceGeofencingColumnError(error)) {
                supportsServiceGeofencingColumnsRef.current = false;
                const fallbackPayload = stripGeofencingColumnsFromPayload(payloadToPersist);
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase
                    .from('servicos')
                    .insert(fallbackPayload)
                    .select()
                    .single());
            }

            if (error && supportsServiceAutoDispatchColumnsRef.current && isMissingServiceAutoDispatchColumnError(error)) {
                supportsServiceAutoDispatchColumnsRef.current = false;
                const fallbackPayload = stripAutoDispatchColumnsFromPayload(payloadToPersist);
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase
                    .from('servicos')
                    .insert(fallbackPayload)
                    .select()
                    .single());
            }

            if (error) throw error;

            const confirmedService: Servico = {
                ...s,
                motoristaId: data.motorista_id,
                centroCustoId: data.centro_custo_id,
                status: deriveServiceLifecycleStatus({
                    motoristaId: data.motorista_id ?? s.motoristaId,
                    serviceDate: data.data,
                    serviceHour: data.hora,
                    originConfirmed: Boolean(data.origin_confirmed || data.origin_arrival_time || s.originConfirmed || s.originArrivalTime),
                    originDepartureTime: data.origin_departure_time || s.originDepartureTime,
                    destinationConfirmed: Boolean(data.destination_confirmed || data.destination_arrival_time || s.destinationConfirmed || s.destinationArrivalTime)
                }),
                concluido: Boolean(data.concluido || data.destination_confirmed || data.destination_arrival_time),
                isUrgent: supportsUrgentColumnRef.current ? Boolean(data.is_urgent) : urgent,
                vehicleId: supportsServiceAutoDispatchColumnsRef.current ? (data.vehicle_id || s.vehicleId || null) : (s.vehicleId || null),
                passengerCount: supportsServiceAutoDispatchColumnsRef.current ? Number(data.passenger_count || s.passengerCount || 1) : Number(s.passengerCount || 1),
                occupancyRate: supportsServiceAutoDispatchColumnsRef.current
                    ? (data.occupancy_rate !== null && data.occupancy_rate !== undefined ? Number(data.occupancy_rate) : (s.occupancyRate ?? null))
                    : (s.occupancyRate ?? null),
                originLocationId: supportsServiceGeofencingColumnsRef.current ? (data.origem_location_id || origemLocation?.id || null) : (s.originLocationId || null),
                destinationLocationId: supportsServiceGeofencingColumnsRef.current ? (data.destino_location_id || destinoLocation?.id || null) : (s.destinationLocationId || null),
                originArrivalTime: supportsServiceGeofencingColumnsRef.current ? (data.origin_arrival_time || null) : (s.originArrivalTime || null),
                destinationArrivalTime: supportsServiceGeofencingColumnsRef.current ? (data.destination_arrival_time || null) : (s.destinationArrivalTime || null),
                originConfirmed: supportsServiceGeofencingColumnsRef.current ? Boolean(data.origin_confirmed) : Boolean(s.originConfirmed),
                destinationConfirmed: supportsServiceGeofencingColumnsRef.current ? Boolean(data.destination_confirmed) : Boolean(s.destinationConfirmed),
                originDepartureTime: supportsServiceGeofencingColumnsRef.current ? (data.origin_departure_time || null) : (s.originDepartureTime || null),
                destinationDepartureTime: supportsServiceGeofencingColumnsRef.current ? (data.destination_departure_time || null) : (s.destinationDepartureTime || null)
            };

            await logServiceHistory(s.id, 'CREATE', null, confirmedService);

            // Trigger Operational Event
            import('../services/operationService').then(m => {
                m.createOperationEvent(
                    'escalas',
                    `Nova escala criada: ${s.passageiro}`,
                    `Nova escala registada para as ${s.hora} de ${s.origem} para ${s.destino}.`,
                    'normal',
                    s.id
                );
            });

            setServicos(prev => [...prev, confirmedService]);

        } catch (error: any) {
            console.error('Error adding service:', error);
            alert(`Erro ao adicionar serviço: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const updateServico = async (s: Servico) => {
        try {
            console.log('Updating service:', s.id, s);
            const urgent = s.isUrgent ?? isServiceUrgent(s.data, s.hora);
            const completedToPersist = Boolean(s.concluido || s.destinationConfirmed || s.destinationArrivalTime);
            const statusToPersist = normalizeStatusForDb(deriveServiceLifecycleStatus({
                motoristaId: s.motoristaId,
                serviceDate: s.data,
                serviceHour: s.hora,
                originConfirmed: Boolean(s.originConfirmed || s.originArrivalTime),
                originDepartureTime: s.originDepartureTime,
                destinationConfirmed: Boolean(s.destinationConfirmed || s.destinationArrivalTime)
            }));
            const origemLocation = resolveLocationByName(s.origem, s.originLocationId);
            const destinoLocation = resolveLocationByName(s.destino, s.destinationLocationId);
            const updatePayload: any = {
                motorista_id: s.motoristaId,
                passageiro: s.passageiro,
                hora: s.hora,
                origem: s.origem,
                destino: s.destino,
                voo: s.voo,
                obs: s.obs,
                concluido: completedToPersist,
                centro_custo_id: s.centroCustoId,
                status: statusToPersist,
                failure_reason: s.failureReason
            };

            if (supportsServiceAutoDispatchColumnsRef.current) {
                updatePayload.vehicle_id = s.vehicleId || null;
                updatePayload.passenger_count = Number(s.passengerCount || 1);
                updatePayload.occupancy_rate = s.occupancyRate ?? null;
            }

            if (supportsServiceGeofencingColumnsRef.current) {
                updatePayload.origem_location_id = origemLocation?.id || null;
                updatePayload.destino_location_id = destinoLocation?.id || null;
                updatePayload.origin_arrival_time = s.originArrivalTime || null;
                updatePayload.destination_arrival_time = s.destinationArrivalTime || null;
                updatePayload.origin_confirmed = Boolean(s.originConfirmed);
                updatePayload.destination_confirmed = Boolean(s.destinationConfirmed);
                updatePayload.origin_departure_time = s.originDepartureTime || null;
                updatePayload.destination_departure_time = s.destinationDepartureTime || null;
            }

            if (supportsUrgentColumnRef.current) {
                updatePayload.is_urgent = urgent;
            }

            let payloadToPersist: any = { ...updatePayload };

            let { data, error } = await supabase.from('servicos').update(payloadToPersist).eq('id', s.id).select();

            if (error && supportsUrgentColumnRef.current && isMissingUrgentColumnError(error)) {
                supportsUrgentColumnRef.current = false;
                const { is_urgent, ...fallbackPayload } = payloadToPersist;
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase.from('servicos').update(fallbackPayload).eq('id', s.id).select());
            }

            if (error && supportsServiceGeofencingColumnsRef.current && isMissingServiceGeofencingColumnError(error)) {
                supportsServiceGeofencingColumnsRef.current = false;
                const fallbackPayload = stripGeofencingColumnsFromPayload(payloadToPersist);
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase.from('servicos').update(fallbackPayload).eq('id', s.id).select());
            }

            if (error && supportsServiceAutoDispatchColumnsRef.current && isMissingServiceAutoDispatchColumnError(error)) {
                supportsServiceAutoDispatchColumnsRef.current = false;
                const fallbackPayload = stripAutoDispatchColumnsFromPayload(payloadToPersist);
                payloadToPersist = fallbackPayload;
                ({ data, error } = await supabase.from('servicos').update(fallbackPayload).eq('id', s.id).select());
            }

            if (error) throw error;

            if (!data || data.length === 0) {
                console.warn('Update succeeded but no rows affected. Service might not exist in DB.');
                // Create it if it doesn't exist? (Upsert). For now, just warn.
                // Verify if we should add it?
                alert('Aviso: Serviço não encontrado na base de dados (pode ter sido apagado). A tentar recriar...');
                await addServico(s);
                return;
            }

            // Find previous state for logging
            const previousState = servicos.find(item => item.id === s.id);
            const persistedRow = data[0] || {};
            const completedAfterPersist = Boolean(
                persistedRow.concluido ?? completedToPersist ?? s.concluido ?? s.destinationConfirmed ?? s.destinationArrivalTime
            );
            const updatedService: Servico = {
                ...s,
                status: deriveServiceLifecycleStatus({
                    motoristaId: persistedRow.motorista_id ?? s.motoristaId,
                    serviceDate: persistedRow.data ?? s.data,
                    serviceHour: persistedRow.hora ?? s.hora,
                    originConfirmed: Boolean(persistedRow.origin_confirmed ?? persistedRow.origin_arrival_time ?? s.originConfirmed ?? s.originArrivalTime),
                    originDepartureTime: persistedRow.origin_departure_time ?? s.originDepartureTime,
                    destinationConfirmed: Boolean(persistedRow.destination_confirmed ?? persistedRow.destination_arrival_time ?? s.destinationConfirmed ?? s.destinationArrivalTime)
                }),
                concluido: completedAfterPersist,
                isUrgent: urgent,
                vehicleId: supportsServiceAutoDispatchColumnsRef.current
                    ? (persistedRow.vehicle_id ?? s.vehicleId ?? null)
                    : (s.vehicleId ?? null),
                passengerCount: supportsServiceAutoDispatchColumnsRef.current
                    ? Number(persistedRow.passenger_count ?? s.passengerCount ?? 1)
                    : Number(s.passengerCount ?? 1),
                occupancyRate: supportsServiceAutoDispatchColumnsRef.current
                    ? (persistedRow.occupancy_rate !== null && persistedRow.occupancy_rate !== undefined ? Number(persistedRow.occupancy_rate) : (s.occupancyRate ?? null))
                    : (s.occupancyRate ?? null),
                originLocationId: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.origem_location_id ?? origemLocation?.id ?? null)
                    : (s.originLocationId ?? null),
                destinationLocationId: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.destino_location_id ?? destinoLocation?.id ?? null)
                    : (s.destinationLocationId ?? null),
                originArrivalTime: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.origin_arrival_time ?? s.originArrivalTime ?? null)
                    : (s.originArrivalTime ?? null),
                destinationArrivalTime: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.destination_arrival_time ?? s.destinationArrivalTime ?? null)
                    : (s.destinationArrivalTime ?? null),
                originConfirmed: supportsServiceGeofencingColumnsRef.current
                    ? Boolean(persistedRow.origin_confirmed ?? s.originConfirmed)
                    : Boolean(s.originConfirmed),
                destinationConfirmed: supportsServiceGeofencingColumnsRef.current
                    ? Boolean(persistedRow.destination_confirmed ?? s.destinationConfirmed)
                    : Boolean(s.destinationConfirmed),
                originDepartureTime: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.origin_departure_time ?? s.originDepartureTime ?? null)
                    : (s.originDepartureTime ?? null),
                destinationDepartureTime: supportsServiceGeofencingColumnsRef.current
                    ? (persistedRow.destination_departure_time ?? s.destinationDepartureTime ?? null)
                    : (s.destinationDepartureTime ?? null)
            };
            await logServiceHistory(s.id, 'UPDATE', previousState, updatedService);

            console.log('Service updated:', data);
            setServicos(prev => prev.map(item => item.id === s.id ? updatedService : item));
        } catch (error: any) {
            console.error('Error updating service:', error);
            alert(`Erro ao atualizar serviço: ${error.message}`);
        }
    };

    const deleteServico = async (id: string) => {
        try {
            console.log('Deleting service:', id);

            // Find service before deleting for log
            const serviceToDelete = servicos.find(item => item.id === id);

            const { error } = await supabase.from('servicos').delete().eq('id', id);
            if (error) throw error;

            await logServiceHistory(id, 'DELETE', serviceToDelete, null);

            console.log('Service deleted');
            setServicos(prev => prev.filter(s => s.id !== id));
        } catch (error: any) {
            console.error('Error deleting service:', error);
            alert(`Erro ao apagar serviço: ${error.message}`);
        }
    };

    // POI Methods
    const addLocal = async (l: Local) => {
        const { error } = await supabase.from('locais').insert({
            nome: l.nome,
            latitude: l.latitude,
            longitude: l.longitude,
            raio: l.raio,
            tipo: l.tipo,
            cor: l.cor,
            user_id: l.userId,
            centro_custo_id: l.centroCustoId
        });
        if (!error) setLocais(prev => [...prev, l]);
    };

    const updateLocal = async (l: Local) => {
        const { error } = await supabase.from('locais').update({
            nome: l.nome,
            latitude: l.latitude,
            longitude: l.longitude,
            raio: l.raio,
            tipo: l.tipo,
            cor: l.cor,
            centro_custo_id: l.centroCustoId
        }).eq('id', l.id);
        if (!error) setLocais(prev => prev.map(item => item.id === l.id ? l : item));
    };

    const deleteLocal = async (id: string) => {
        const { error } = await supabase.from('locais').delete().eq('id', id);
        if (!error) setLocais(prev => prev.filter(l => l.id !== id));
    };

    const checkRouteValidation = async (serviceId: string) => {
        const service = servicos.find(s => s.id === serviceId);
        if (!service) return {};

        const validationPoints = service.validationPoints || [];
        if (validationPoints.length === 0) return {};

        const driver = motoristas.find(m => m.id === service.motoristaId);
        let vehicleId = driver?.cartrackId;

        if (!vehicleId && driver?.currentVehicle) {
            const cv = cartrackVehicles.find(v => v.registration.replace(/[^a-zA-Z0-9]/g, '') === driver?.currentVehicle?.replace(/[^a-zA-Z0-9]/g, ''));
            if (cv) vehicleId = cv.id;
        }

        if (!vehicleId) return {};

        const [sh, sm] = service.hora.split(':').map(Number);
        const serviceDate = new Date();
        serviceDate.setHours(sh, sm, 0, 0);

        const start = new Date(serviceDate.getTime() - 30 * 60000).toISOString();
        const end = new Date(serviceDate.getTime() + 180 * 60000).toISOString();

        try {
            const history = await CartrackService.getRouteHistory(vehicleId, start, end);

            const results: Record<string, { status: 'success' | 'failed'; time?: string; distance?: number }> = {};

            service.validationPoints.forEach((poiId: string) => {
                const poi = locais.find(l => l.id === poiId);
                if (!poi) return;

                let minDist = Infinity;
                let matchTime = null;

                for (const point of history) {
                    const R = 6371e3;
                    const φ1 = point.lat * Math.PI / 180;
                    const φ2 = poi.latitude * Math.PI / 180;
                    const Δφ = (poi.latitude - point.lat) * Math.PI / 180;
                    const Δλ = (poi.longitude - point.lng) * Math.PI / 180;

                    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const d = R * c;

                    if (d < minDist) {
                        minDist = d;
                        matchTime = point.time;
                    }
                }

                if (minDist <= (poi.raio || 50) + 50) {
                    results[poiId] = { status: 'success', time: matchTime || undefined, distance: minDist };
                } else {
                    results[poiId] = { status: 'failed', distance: minDist };
                }
            });
            return results;
        } catch (e) {
            console.error('Route Validation Error:', e);
            return {};
        }
    };

    // Routing Methods
    const saveRoute = async (routeData: Partial<RotaPlaneada>) => {
        try {
            const { data, error } = await supabase
                .from('rotas_planeadas')
                .insert([routeData])
                .select()
                .single();

            if (error) throw error;
            setRotasPlaneadas(prev => [data, ...prev]);

            const { data: authData } = await supabase.auth.getUser();
            await registerLog({
                utilizador: authData?.user?.email || 'Sistema',
                acao: 'Criação de rota',
                referencia_id: data.id,
                detalhes_json: { viatura_id: data.viatura_id, motorista_id: data.motorista_id }
            });

            return { success: true, data };
        } catch (error: any) {
            console.error('Error saving route:', error);
            return { success: false, error: error.message };
        }
    };

    const updateRouteStatus = async (id: string, status: 'concluida' | 'cancelada', realDistance?: number, justification?: string) => {
        try {
            const updateData: any = {
                estado: status,
                concluida_at: status === 'concluida' ? new Date().toISOString() : null
            };

            if (realDistance !== undefined) {
                updateData.distancia_real = realDistance;
                const route = rotasPlaneadas.find(r => r.id === id);
                if (route && route.distancia_estimada) {
                    const diff = Math.abs(realDistance - route.distancia_estimada) / route.distancia_estimada;
                    if (diff > 0.20) {
                        updateData.flag_desvio = true;
                    }
                }
            }

            if (justification) {
                updateData.justificacao_desvio = justification;
            }

            const { error } = await supabase
                .from('rotas_planeadas')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            setRotasPlaneadas(prev => prev.map(r => r.id === id ? { ...r, ...updateData } : r));

            const { data: authData } = await supabase.auth.getUser();
            await registerLog({
                utilizador: authData?.user?.email || 'Sistema',
                acao: `Rota ${status === 'concluida' ? 'concluída' : 'cancelada'}`,
                referencia_id: id,
                detalhes_json: { realDistance, flag_desvio: updateData.flag_desvio }
            });

        } catch (error) {
            console.error('Error updating route status:', error);
        }
    };

    const registerLog = async (log: Omit<LogOperacional, 'id' | 'data_hora'>) => {
        try {
            const { data, error } = await supabase
                .from('logs_operacionais')
                .insert([log])
                .select()
                .single();

            if (error) throw error;
            setLogsOperacionais(prev => [data, ...prev].slice(0, 500));
        } catch (error) {
            console.error('Error registering log:', error);
        }
    };

    // Fuel Methods
    const updateFuelTank = async (tank: FuelTank) => {
        const { error } = await supabase.from('fuel_tank').upsert({
            id: 'main',
            capacity: tank.capacity,
            current_level: tank.currentLevel,
            pump_totalizer: tank.pumpTotalizer,
            last_refill_date: tank.lastRefillDate,
            average_price: tank.averagePrice,
            baseline_date: tank.baselineDate,
            baseline_level: tank.baselineLevel,
            baseline_totalizer: tank.baselineTotalizer
        });
        if (error) {
            console.error("Erro ao atualizar tanque:", error);
            throw new Error(`Erro ao atualizar tanque: ${error.message}`);
        }
        setFuelTank(tank);
    };

    const registerRefuel = async (transaction: FuelTransaction) => {
        const currentPMP = fuelTank.averagePrice || 0;

        // Trust provided values (e.g. from BP imports) or fallback to internal PMP
        const finalPrice = transaction.pricePerLiter ?? currentPMP;
        const finalTotal = transaction.totalCost ?? (transaction.liters * currentPMP);

        let finalStatus = transaction.status || 'pending';
        let pumpCounterAfter = 0;

        // KM Validation (Sequential for the specific vehicle)
        // Find the record that comes immediately BEFORE this one in time for the same vehicle
        const prevTx = fuelTransactions
            .filter(t => t.vehicleId === transaction.vehicleId && t.status === 'confirmed' && new Date(t.timestamp) < new Date(transaction.timestamp))
            .reduce((prev, curr) => (new Date(curr.timestamp) > new Date(prev.timestamp) ? curr : prev), { timestamp: '1970-01-01', km: 0 } as any);

        // Find the record that comes immediately AFTER this one in time for the same vehicle
        const nextTx = fuelTransactions
            .filter(t => t.vehicleId === transaction.vehicleId && t.status === 'confirmed' && new Date(t.timestamp) > new Date(transaction.timestamp))
            .reduce((prev, curr) => (new Date(curr.timestamp) < new Date(prev.timestamp) ? curr : prev), { timestamp: '9999-12-31', km: Infinity } as any);

        if (transaction.km < prevTx.km) {
            throw new Error(`Leitura de odómetro inválida. O valor anterior (${new Date(prevTx.timestamp).toLocaleDateString()}) foi ${prevTx.km} KM.`);
        }
        if (transaction.km > nextTx.km) {
            throw new Error(`Leitura de odómetro inválida. Existe um registo posterior (${new Date(nextTx.timestamp).toLocaleDateString()}) com ${nextTx.km} KM.`);
        }

        // Auto-calculate consumption if possible
        const lastTxForCons = prevTx;

        // Auto-calculate consumption if possible
        const consumption = (transaction.km > lastTxForCons.km && lastTxForCons.km > 0 && transaction.liters > 0)
            ? Number(((transaction.liters / (transaction.km - lastTxForCons.km)) * 100).toFixed(2))
            : undefined;

        // If explicitly confirmed AND NOT EXTERNAL, calculate tank updates immediately
        if (finalStatus === 'confirmed' && !transaction.isExternal) {
            const currentTotalizer = fuelTank.pumpTotalizer || 0;
            pumpCounterAfter = currentTotalizer + transaction.liters;
            const newLevel = Math.max(0, fuelTank.currentLevel - transaction.liters);

            // Update Tank immediately
            await updateFuelTank({
                ...fuelTank,
                currentLevel: newLevel,
                pumpTotalizer: pumpCounterAfter
            });
        }

        const transactionToSave: FuelTransaction = {
            ...transaction,
            status: finalStatus,
            pricePerLiter: finalPrice,
            totalCost: finalTotal,
            consumoCalculado: consumption,
            isAnormal: consumption ? (consumption > 20) : false, // Example threshold: 20L/100km or could be based on avg
            pumpCounterAfter: (finalStatus === 'confirmed' && !transaction.isExternal) ? pumpCounterAfter : undefined
        };

        const { error: insertError } = await supabase.from('fuel_transactions').insert({
            id: transactionToSave.id,
            driver_id: transactionToSave.driverId,
            vehicle_id: transactionToSave.vehicleId,
            liters: transactionToSave.liters,
            km: transactionToSave.km,
            staff_id: transactionToSave.staffId,
            staff_name: transactionToSave.staffName,
            status: transactionToSave.status,
            timestamp: transactionToSave.timestamp,
            price_per_liter: transactionToSave.pricePerLiter,
            total_cost: transactionToSave.totalCost,
            centro_custo_id: transactionToSave.centroCustoId,
            pump_counter_after: transactionToSave.pumpCounterAfter,
            is_external: transactionToSave.isExternal,
            consumo_calculado: transactionToSave.consumoCalculado,
            is_anormal: transactionToSave.isAnormal
        });

        if (insertError) {
            throw new Error(`Erro na base de dados: ${insertError.message}`);
        }

        setFuelTransactions(prev => [transactionToSave, ...prev]);

        // Only send notification if PENDING
        if (finalStatus === 'pending') {
            addNotification({
                id: crypto.randomUUID(),
                type: 'fuel_confirmation_request',
                data: {
                    liters: transaction.liters,
                    km: transaction.km,
                    vehicleId: transaction.vehicleId, // or Plate
                    licensePlate: transaction.vehicleId,
                    staffId: transaction.staffId
                },
                status: 'pending',
                response: {
                    driverId: transaction.driverId,
                    serviceId: transaction.id
                },
                timestamp: new Date().toISOString()
            });
        }
    };

    const confirmRefuel = async (transactionId: string) => {
        const transaction = fuelTransactions.find(t => t.id === transactionId);
        if (transaction && transaction.status === 'pending') {
            const currentTotalizer = fuelTank.pumpTotalizer || 0;
            const newTotalizer = currentTotalizer + transaction.liters;
            const newLevel = Math.max(0, fuelTank.currentLevel - transaction.liters);

            // Update Transaction
            const { error: transError } = await supabase.from('fuel_transactions').update({
                status: 'confirmed',
                pump_counter_after: newTotalizer
            }).eq('id', transactionId);

            // Update Tank
            if (!transError) {
                await updateFuelTank({
                    ...fuelTank,
                    currentLevel: newLevel,
                    pumpTotalizer: newTotalizer
                });

                setFuelTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, status: 'confirmed', pumpCounterAfter: newTotalizer } : t));
            }
            return { error: transError };
        }
        return { error: 'Transaction not found or not pending' };
    };

    const updateFuelTransaction = async (id: string, updates: Partial<FuelTransaction>) => {
        const { error } = await supabase
            .from('fuel_transactions')
            .update({
                liters: updates.liters,
                km: updates.km,
                centro_custo_id: updates.centroCustoId,
                total_cost: updates.totalCost,
                price_per_liter: updates.pricePerLiter,
                timestamp: updates.timestamp,
                driver_id: updates.driverId,
                vehicle_id: updates.vehicleId,
                status: updates.status,
                is_anormal: updates.isAnormal,
                consumo_calculado: updates.consumoCalculado
            })
            .eq('id', id);

        if (!error) {
            setFuelTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
        }
        return { error };
    };

    const registerTankRefill = async (log: TankRefillLog) => {
        // Calculate new PMP
        const currentVolume = fuelTank.currentLevel;
        const currentPrice = fuelTank.averagePrice || 0;
        const addedVolume = log.litersAdded;
        const addedPrice = log.pricePerLiter || 0;
        let newAveragePrice = currentPrice;
        if (currentVolume + addedVolume > 0) {
            newAveragePrice = ((currentVolume * currentPrice) + (addedVolume * addedPrice)) / (currentVolume + addedVolume);
        }

        const newLevel = Math.min(fuelTank.capacity, fuelTank.currentLevel + log.litersAdded);
        const newTotalizer = log.pumpMeterReading > 0 ? log.pumpMeterReading : fuelTank.pumpTotalizer;

        const { error } = await supabase.from('tank_refills').insert({
            id: log.id,
            liters_added: log.litersAdded,
            level_before: log.levelBefore,
            level_after: log.levelAfter,
            total_spent_since_last: log.totalSpentSinceLast,
            pump_meter_reading: log.pumpMeterReading,
            system_expected_reading: log.systemExpectedReading,
            supplier: log.supplier,
            timestamp: log.timestamp,
            staff_id: log.staffId,
            staff_name: log.staffName,
            price_per_liter: log.pricePerLiter,
            total_cost: log.totalCost
        });

        if (!error) {
            const isAfterBaseline = !fuelTank.baselineDate || new Date(log.timestamp) >= new Date(fuelTank.baselineDate);

            if (isAfterBaseline) {
                await updateFuelTank({
                    ...fuelTank,
                    currentLevel: newLevel,
                    pumpTotalizer: newTotalizer,
                    lastRefillDate: log.timestamp,
                    averagePrice: newAveragePrice
                });
            } else {
                // If before baseline, we might still want to update PMP? 
                // User said: "Não recalcular automaticamente movimentos anteriores ao baseline."
                // So we'll keep the current level and price as is.
            }
            setTankRefills(prev => [log, ...prev]);
        }
    };

    const setPumpTotalizer = async (val: number) => {
        await updateFuelTank({ ...fuelTank, pumpTotalizer: val });
    };

    const recalculateFuelTank = async () => {
        if (!fuelTank.baselineDate) {
            throw new Error("Defina primeiro uma data de Baseline nas configurações do tanque.");
        }

        const baselineDateStr = fuelTank.baselineDate.split('T')[0];

        // Use fuelTransactions and tankRefills from state (which are already filtered/processed)
        const relevantTransactions = fuelTransactions.filter(t =>
            t.status === 'confirmed' &&
            !t.isExternal &&
            new Date(t.timestamp) >= new Date(fuelTank.baselineDate as string)
        );

        const relevantRefills = tankRefills.filter(r =>
            new Date(r.timestamp) >= new Date(fuelTank.baselineDate as string)
        );

        const totalLitersUsed = relevantTransactions.reduce((sum, t) => sum + t.liters, 0);
        const totalLitersAdded = relevantRefills.reduce((sum, r) => sum + r.litersAdded, 0);

        const newLevel = (fuelTank.baselineLevel || 0) + totalLitersAdded - totalLitersUsed;
        const newTotalizer = (fuelTank.baselineTotalizer || 0) + totalLitersUsed;

        await updateFuelTank({
            ...fuelTank,
            currentLevel: Math.max(0, newLevel),
            pumpTotalizer: newTotalizer
        });

        return { newLevel, newTotalizer };
    };

    const deleteFuelTransaction = async (id: string) => {
        const trans = fuelTransactions.find(t => t.id === id);
        if (trans) {
            const { error } = await supabase.from('fuel_transactions').delete().eq('id', id);
            if (!error) {
                // If the transaction was confirmed, revert the tank changes
                if (trans.status === 'confirmed') {
                    const isAfterBaseline = !fuelTank.baselineDate || new Date(trans.timestamp) >= new Date(fuelTank.baselineDate);

                    if (isAfterBaseline) {
                        const currentTotalizer = fuelTank.pumpTotalizer || 0;
                        const reversedTotalizer = Math.max(0, currentTotalizer - trans.liters);
                        const reversedLevel = Math.min(fuelTank.capacity, fuelTank.currentLevel + trans.liters);

                        await updateFuelTank({
                            ...fuelTank,
                            currentLevel: reversedLevel,
                            pumpTotalizer: reversedTotalizer
                        });
                    }
                }
                setFuelTransactions(prev => prev.filter(t => t.id !== id));
            } else {
                alert('Erro ao apagar abastecimento: ' + error.message);
            }
        }
    };

    const deleteTankRefill = async (id: string) => {
        const refill = tankRefills.find(r => r.id === id);
        if (refill) {
            const { error } = await supabase.from('tank_refills').delete().eq('id', id);
            if (!error) {
                const isAfterBaseline = !fuelTank.baselineDate || new Date(refill.timestamp) >= new Date(fuelTank.baselineDate);

                if (isAfterBaseline) {
                    // Revert tank level (Fuel In -> Revert by removing liters)
                    const reversedLevel = Math.max(0, fuelTank.currentLevel - refill.litersAdded);

                    await updateFuelTank({
                        ...fuelTank,
                        currentLevel: reversedLevel
                        // We do not revert PMP or Totalizer here as it's complex/ambiguous for Supplies
                    });
                }

                setTankRefills(prev => prev.filter(t => t.id !== id));
            } else {
                alert('Erro ao apagar entrada de combustível: ' + error.message);
            }
        }
    };
    const addFornecedor = async (f: Fornecedor) => {
        const { error } = await supabase.from('fornecedores').insert(f);
        if (!error) setFornecedores(prev => [...prev, f]);
    };

    const updateFornecedor = async (f: Fornecedor) => {
        const supplierPayload = {
            name: f.nome,
            nif: f.nif,
            phone: f.contacto,
            email: f.email,
            address: f.morada,
            notes: f.obs
        };

        const { error: suppliersError } = await supabase
            .from('suppliers')
            .update(supplierPayload)
            .eq('id', f.id);

        if (suppliersError) {
            const { error: fornecedoresError } = await supabase.from('fornecedores').update({
                nome: f.nome,
                nif: f.nif,
                contacto: f.contacto,
                email: f.email,
                morada: f.morada,
                obs: f.obs,
                foto: f.foto
            }).eq('id', f.id);

            if (fornecedoresError) return;
        }

        if (!suppliersError) {
            setFornecedores(prev => prev.map(curr => curr.id === f.id ? f : curr));
            return;
        }

        setFornecedores(prev => prev.map(curr => curr.id === f.id ? f : curr));
    };

    const deleteFornecedor = async (id: string) => {
        const { error } = await supabase.from('fornecedores').delete().eq('id', id);
        if (!error) setFornecedores(prev => prev.filter(f => f.id !== id));
    };

    const addCliente = async (c: Cliente) => {
        const { error } = await supabase.from('clientes').insert(c);
        if (error) console.error('Error inserting client:', error);
        else setClientes(prev => [...prev, c]);
    };
    const updateCliente = async (c: Cliente) => {
        const { error } = await supabase.from('clientes').update(c).eq('id', c.id);
        if (!error) setClientes(prev => prev.map(curr => curr.id === c.id ? c : curr));
    };
    const deleteCliente = async (id: string) => {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (!error) setClientes(prev => prev.filter(c => c.id !== id));
    };

    const addViatura = async (v: Viatura) => {
        const { error } = await supabase.from('viaturas').insert({
            id: v.id,
            matricula: v.matricula,
            marca: v.marca,
            modelo: v.modelo,
            ano: v.ano,
            obs: v.obs,
            preco_diario: v.precoDiario,
            vehicle_capacity: v.vehicleCapacity ?? 8,
            centro_custo_id: v.centro_custo_id // Fix: Persist Cost Center
        });
        if (!error) setViaturas(prev => [...prev, v]);
    };
    const updateViatura = async (v: Viatura) => {
        const { error } = await supabase.from('viaturas').update({
            matricula: v.matricula,
            marca: v.marca,
            modelo: v.modelo,
            ano: v.ano,
            obs: v.obs,
            preco_diario: v.precoDiario,
            vehicle_capacity: v.vehicleCapacity ?? 8,
            centro_custo_id: v.centro_custo_id // Fix: Persist Cost Center
        }).eq('id', v.id);
        if (!error) setViaturas(prev => prev.map(curr => curr.id === v.id ? v : curr));
    };
    const deleteViatura = async (id: string) => {
        const { error } = await supabase.from('viaturas').delete().eq('id', id);
        if (!error) setViaturas(prev => prev.filter(v => v.id !== id));
    };

    const syncStockFromRequisition = async (
        requisicao: Requisicao,
        options?: { notifyOnFailure?: boolean }
    ): Promise<{ failedItems: string[] }> => {
        if (requisicao.tipo !== 'Stock' || !Array.isArray(requisicao.itens) || requisicao.itens.length === 0) {
            return { failedItems: [] };
        }

        const { data: existingReqEntries } = await supabase
            .from('stock_movements')
            .select('item_id')
            .eq('source_document', 'requisition')
            .eq('movement_type', 'entry')
            .eq('document_id', requisicao.id);

        const existingEntryItemIds = new Set((existingReqEntries || []).map((entry: any) => String(entry.item_id)));

        const normalizeStockName = (value: string) => value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

        const isMissingTableError = (error: any, table: 'stock_items' | 'workshop_items') => {
            if (!error) return false;
            const message = String(error.message || '').toLowerCase();
            return message.includes(`public.${table}`) || message.includes(`relation \"public.${table}\"`);
        };

        let stockItemsTable: 'stock_items' | 'workshop_items' = stockItemsTableRef.current;

        const switchToLegacyTable = () => {
            stockItemsTable = 'workshop_items';
            stockItemsTableRef.current = 'workshop_items';
        };

        const fetchStockItemsFromDb = async () => {
            let response = await supabase
                .from(stockItemsTable)
                .select('*, supplier:fornecedores(*)');

            if (isMissingTableError(response.error, 'stock_items') && stockItemsTable === 'stock_items') {
                switchToLegacyTable();
                response = await supabase
                    .from(stockItemsTable)
                    .select('*, supplier:fornecedores(*)');
            }

            return response;
        };

        const { data: existingDbItems } = await fetchStockItemsFromDb();

        const baseStockItems = (existingDbItems && existingDbItems.length > 0)
            ? existingDbItems
            : stockItems;

        const requisicoesForSync = requisicoes.some(req => req.id === requisicao.id)
            ? requisicoes
            : [requisicao, ...requisicoes];

        const stockByName = new Map(
            baseStockItems
                .filter(item => item.name?.trim())
                .map(item => [normalizeStockName(item.name.trim()), item])
        );

        const failedItems: string[] = [];
        const failedDetails: string[] = [];

        const registerFailure = (description: string, reason?: string) => {
            failedItems.push(description);
            if (reason) {
                failedDetails.push(`${description} (${reason})`);
            } else {
                failedDetails.push(description);
            }
        };

        for (const requisitionItem of requisicao.itens) {
            const description = requisitionItem.descricao?.trim();
            const quantity = Number(requisitionItem.quantidade ?? 0);

            if (!description || !Number.isFinite(quantity) || quantity <= 0) {
                continue;
            }

            const valueTotal = Number(requisitionItem.valor_total ?? 0);
            const valueUnit = Number(requisitionItem.valor_unitario ?? 0);
            const unitCost = Number.isFinite(valueUnit) && valueUnit > 0
                ? valueUnit
                : (Number.isFinite(valueTotal) && valueTotal > 0
                    ? valueTotal / quantity
                    : 0);

            const normalizedName = normalizeStockName(description);
            let stockItem = stockByName.get(normalizedName);

            if (!stockItem) {
                let { data: newStockItem, error: stockItemError } = await supabase
                    .from(stockItemsTable)
                    .insert({
                        name: description,
                        category: 'Requisição',
                        stock_quantity: 0,
                        minimum_stock: 0,
                        average_cost: unitCost,
                        supplier_id: requisicao.fornecedorId || null
                    })
                    .select('*, supplier:fornecedores(*)')
                    .single();

                if (isMissingTableError(stockItemError, 'stock_items') && stockItemsTable === 'stock_items') {
                    switchToLegacyTable();
                    const retryWithLegacyTable = await supabase
                        .from(stockItemsTable)
                        .insert({
                            name: description,
                            category: 'Requisição',
                            stock_quantity: 0,
                            minimum_stock: 0,
                            average_cost: unitCost,
                            supplier_id: requisicao.fornecedorId || null
                        })
                        .select('*, supplier:fornecedores(*)')
                        .single();

                    newStockItem = retryWithLegacyTable.data;
                    stockItemError = retryWithLegacyTable.error;
                }

                const isSupplierFkError = !!stockItemError && stockItemError.code === '23503' && (stockItemError.message || '').toLowerCase().includes('supplier_id');

                if ((stockItemError || !newStockItem) && isSupplierFkError) {
                    const retryInsert = await supabase
                        .from(stockItemsTable)
                        .insert({
                            name: description,
                            category: 'Requisição',
                            stock_quantity: 0,
                            minimum_stock: 0,
                            average_cost: unitCost,
                            supplier_id: null
                        })
                        .select('*, supplier:fornecedores(*)')
                        .single();

                    newStockItem = retryInsert.data;
                    stockItemError = retryInsert.error;
                }

                if (stockItemError || !newStockItem) {
                    const searchToken = description.replace(/[%_]/g, ' ').trim();
                    let existingByNameResponse = await supabase
                        .from(stockItemsTable)
                        .select('*, supplier:fornecedores(*)')
                        .ilike('name', `%${searchToken}%`)
                        .limit(25);

                    if (isMissingTableError(existingByNameResponse.error, 'stock_items') && stockItemsTable === 'stock_items') {
                        switchToLegacyTable();
                        existingByNameResponse = await supabase
                            .from(stockItemsTable)
                            .select('*, supplier:fornecedores(*)')
                            .ilike('name', `%${searchToken}%`)
                            .limit(25);
                    }

                    const existingByNameCandidates = existingByNameResponse.data;

                    const existingByName = (existingByNameCandidates || []).find((candidate: any) => {
                        const candidateNormalized = normalizeStockName(String(candidate?.name || ''));
                        return candidateNormalized === normalizedName
                            || candidateNormalized.includes(normalizedName)
                            || normalizedName.includes(candidateNormalized);
                    }) || (existingByNameCandidates || [])[0];

                    if (!existingByName) {
                        console.error('Error creating stock item from requisition:', stockItemError);
                        registerFailure(description, stockItemError?.message || stockItemError?.code || 'erro a criar item');
                        continue;
                    }

                    stockItem = existingByName as import('../types').StockItem;
                } else {
                    stockItem = newStockItem as import('../types').StockItem;
                }

                stockByName.set(normalizedName, stockItem);

                setStockItems(prev => {
                    if (prev.some(item => item.id === stockItem!.id)) {
                        return prev.map(item => item.id === stockItem!.id ? stockItem! : item);
                    }
                    return [...prev, stockItem!];
                });
            }

            const { count: reqEntryCount } = await supabase
                .from('stock_movements')
                .select('id', { count: 'exact', head: true })
                .eq('source_document', 'requisition')
                .eq('movement_type', 'entry')
                .eq('item_id', stockItem.id);

            const { count: nonReqOrNonEntryCount } = await supabase
                .from('stock_movements')
                .select('id', { count: 'exact', head: true })
                .eq('item_id', stockItem.id)
                .or('source_document.neq.requisition,movement_type.neq.entry');

            const hasAnyReqEntryForItem = Number(reqEntryCount || 0) > 0;
            const hasOtherMovementTypes = Number(nonReqOrNonEntryCount || 0) > 0;

            const expectedQtyFromStockRequisitions = requisicoesForSync
                .filter(req => req.tipo === 'Stock')
                .reduce((sum, req) => {
                    const reqItems = Array.isArray(req.itens) ? req.itens : [];
                    const reqItemQty = reqItems.reduce((itemSum, reqItem) => {
                        const reqDescription = reqItem.descricao?.trim();
                        const reqNormalized = reqDescription ? normalizeStockName(reqDescription) : '';
                        if (!reqNormalized || reqNormalized !== normalizedName) {
                            return itemSum;
                        }

                        const reqQuantity = Number(reqItem.quantidade ?? 0);
                        if (!Number.isFinite(reqQuantity) || reqQuantity <= 0) {
                            return itemSum;
                        }

                        return itemSum + reqQuantity;
                    }, 0);

                    return sum + reqItemQty;
                }, 0);

            if (expectedQtyFromStockRequisitions > 0 && !hasOtherMovementTypes) {
                const currentQty = Number(stockItem.stock_quantity ?? 0);
                const shouldReconcile = !hasAnyReqEntryForItem
                    ? currentQty > expectedQtyFromStockRequisitions
                    : currentQty !== expectedQtyFromStockRequisitions;

                if (shouldReconcile) {
                    const { data: reconciledItem, error: reconcileError } = await supabase
                        .from(stockItemsTable)
                        .update({ stock_quantity: expectedQtyFromStockRequisitions })
                        .eq('id', stockItem.id)
                        .select('*, supplier:fornecedores(*)')
                        .single();

                    if (!reconcileError && reconciledItem) {
                        stockItem = reconciledItem as import('../types').StockItem;
                        stockByName.set(normalizedName, stockItem);
                        setStockItems(prev => {
                            if (prev.some(item => item.id === stockItem!.id)) {
                                return prev.map(item => item.id === stockItem!.id ? stockItem! : item);
                            }
                            return [...prev, stockItem!];
                        });
                    }
                }
            }

            if (existingEntryItemIds.has(String(stockItem.id))) {
                continue;
            }

            const { data: movementData, error: movementError } = await supabase
                .from('stock_movements')
                .insert({
                    item_id: stockItem.id,
                    movement_type: 'entry',
                    quantity,
                    average_cost_at_time: unitCost,
                    source_document: 'requisition',
                    document_id: requisicao.id,
                    notes: `Requisicao Stock: ${requisicao.numero}`
                })
                .select('*, item:stock_items(*)')
                .single();

            if (movementError || !movementData) {
                const isDuplicateMovement = !!movementError && (
                    movementError.code === '23505'
                    || (movementError.message || '').toLowerCase().includes('duplicate')
                );

                if (isDuplicateMovement) {
                    existingEntryItemIds.add(String(stockItem.id));
                    continue;
                }

                const { data: currentItem } = await supabase
                    .from(stockItemsTable)
                    .select('id, stock_quantity, average_cost, supplier_id, name')
                    .eq('id', stockItem.id)
                    .single();

                if (!currentItem) {
                    console.error('Error creating stock movement from requisition:', movementError);
                    registerFailure(description, movementError?.message || movementError?.code || 'erro ao criar movimento');
                    continue;
                }

                const currentQty = Number(currentItem.stock_quantity ?? 0);
                const currentAvg = Number(currentItem.average_cost ?? 0);
                const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
                const targetQtyFromRequisitions = expectedQtyFromStockRequisitions > 0
                    ? expectedQtyFromStockRequisitions
                    : (currentQty + quantity);
                const newQty = Math.max(currentQty, targetQtyFromRequisitions);
                const newAvg = newQty > 0
                    ? ((currentQty * currentAvg) + (quantity * safeUnitCost)) / newQty
                    : currentAvg;

                const stockUpdatePayload: any = {
                    stock_quantity: newQty,
                    average_cost: Number(newAvg.toFixed(6))
                };

                if (!currentItem.supplier_id && requisicao.fornecedorId) {
                    stockUpdatePayload.supplier_id = requisicao.fornecedorId;
                }

                let { data: fallbackUpdatedItem, error: fallbackUpdateError } = await supabase
                    .from(stockItemsTable)
                    .update(stockUpdatePayload)
                    .eq('id', stockItem.id)
                    .select('*, supplier:fornecedores(*)')
                    .single();

                if (isMissingTableError(fallbackUpdateError, 'stock_items') && stockItemsTable === 'stock_items') {
                    switchToLegacyTable();
                    const retryFallbackWithLegacyTable = await supabase
                        .from(stockItemsTable)
                        .update(stockUpdatePayload)
                        .eq('id', stockItem.id)
                        .select('*, supplier:fornecedores(*)')
                        .single();

                    fallbackUpdatedItem = retryFallbackWithLegacyTable.data;
                    fallbackUpdateError = retryFallbackWithLegacyTable.error;
                }

                const isFallbackSupplierFkError = !!fallbackUpdateError && fallbackUpdateError.code === '23503' && (fallbackUpdateError.message || '').toLowerCase().includes('supplier_id');

                if ((fallbackUpdateError || !fallbackUpdatedItem) && isFallbackSupplierFkError) {
                    delete stockUpdatePayload.supplier_id;
                    const retryFallback = await supabase
                        .from(stockItemsTable)
                        .update(stockUpdatePayload)
                        .eq('id', stockItem.id)
                        .select('*, supplier:fornecedores(*)')
                        .single();

                    fallbackUpdatedItem = retryFallback.data;
                    fallbackUpdateError = retryFallback.error;
                }

                if (fallbackUpdateError || !fallbackUpdatedItem) {
                    console.error('Error creating stock movement from requisition:', movementError);
                    console.error('Fallback stock quantity update failed:', fallbackUpdateError);
                    registerFailure(description, fallbackUpdateError?.message || movementError?.message || movementError?.code || 'erro fallback de stock');
                    continue;
                }

                existingEntryItemIds.add(String(stockItem.id));

                setStockItems(prev => {
                    if (prev.some(item => item.id === fallbackUpdatedItem.id)) {
                        return prev.map(item => item.id === fallbackUpdatedItem.id ? fallbackUpdatedItem as import('../types').StockItem : item);
                    }
                    return [...prev, fallbackUpdatedItem as import('../types').StockItem];
                });

                const normalizedUpdatedName = fallbackUpdatedItem.name?.trim() ? normalizeStockName(fallbackUpdatedItem.name.trim()) : '';
                if (normalizedUpdatedName) {
                    stockByName.set(normalizedUpdatedName, fallbackUpdatedItem as import('../types').StockItem);
                }

                continue;
            }

            setStockMovements(prev => [movementData as import('../types').StockMovement, ...prev]);
            existingEntryItemIds.add(String(stockItem.id));

            const { data: updatedItem } = await supabase
                .from(stockItemsTable)
                .select('*, supplier:fornecedores(*)')
                .eq('id', stockItem.id)
                .single();

            if (updatedItem) {
                const normalizedUpdatedName = updatedItem.name?.trim().toLowerCase();
                if (normalizedUpdatedName) {
                    stockByName.set(normalizedUpdatedName, updatedItem as import('../types').StockItem);
                }

                setStockItems(prev => {
                    if (prev.some(item => item.id === updatedItem.id)) {
                        return prev.map(item => item.id === updatedItem.id ? updatedItem as import('../types').StockItem : item);
                    }
                    return [...prev, updatedItem as import('../types').StockItem];
                });
            }
        }

        if (failedItems.length > 0 && options?.notifyOnFailure) {
            const detailsPreview = failedDetails.slice(0, 3).join(' | ');
            alert(`Alguns itens de Stock não foram criados automaticamente: ${detailsPreview}${failedDetails.length > 3 ? ' | ...' : ''}`);
        }

        return { failedItems };
    };

    const addRequisicao = async (r: Requisicao) => {
        const { error } = await supabase.from('requisicoes').insert({
            id: r.id,
            numero: r.numero,
            data: r.data,
            tipo: r.tipo,
            cliente_id: r.clienteId || null,
            fornecedor_id: r.fornecedorId,
            viatura_id: r.viaturaId,
            centro_custo_id: r.centroCustoId,
            obs: r.obs || '',
            status: r.status || 'pendente',
            erp_status: r.erp_status || 'pending',
            approved_value: r.approved_value ?? null,
            criado_por: r.criadoPor,
            supplier_confirmed: r.supplier_confirmed ?? false,
            supplier_confirmed_at: r.supplier_confirmed_at ?? null,
            supplier_refused: r.supplier_refused ?? r.supplier_rejected ?? false,
            supplier_refused_at: r.supplier_refused_at ?? null,
            supplier_rejected: r.supplier_rejected ?? r.supplier_refused ?? false,
            supplier_comment: r.supplier_comment ?? null,
            supplier_response_date: r.supplier_response_date ?? null,
            itens: r.itens
        });
        if (error) {
            console.error('Error adding requisition:', error);
            return;
        }
        setRequisicoes(prev => [{ ...r, status: r.status || 'pendente' }, ...prev]);
    };

    const runStockRequisitionsSync = async (): Promise<{ processed: number; failed: number }> => {
        if (!STOCK_REQUISITION_SYNC_ENABLED) {
            return { processed: 0, failed: 0 };
        }

        if (stockBackfillRunningRef.current) {
            return { processed: 0, failed: 0 };
        }

        const stockRequisitions = requisicoes.filter(req => req.tipo === 'Stock');
        if (stockRequisitions.length === 0) {
            return { processed: 0, failed: 0 };
        }

        stockBackfillRunningRef.current = true;
        let processed = 0;
        let failed = 0;

        try {
            const candidateRequisitions = stockRequisitions.filter(req => {
                if (stockSyncInProgressReqIdsRef.current.has(req.id)) return false;
                return true;
            });
            if (candidateRequisitions.length === 0) return { processed: 0, failed: 0 };

            for (const requisicao of candidateRequisitions) {
                stockSyncInProgressReqIdsRef.current.add(requisicao.id);
                try {
                    const result = await syncStockFromRequisition(requisicao, {
                        notifyOnFailure: true
                    });
                    if (result.failedItems.length > 0) {
                        failed += 1;
                    } else {
                        processed += 1;
                    }
                } catch (syncError) {
                    failed += 1;
                    console.error('Error syncing requisition to stock:', requisicao.id, syncError);
                } finally {
                    stockSyncInProgressReqIdsRef.current.delete(requisicao.id);
                }
            }

            return { processed, failed };
        } finally {
            stockBackfillRunningRef.current = false;
        }
    };

    const syncStockRequisitionsToInventory = async (): Promise<{ processed: number; failed: number }> => {
        return runStockRequisitionsSync();
    };

    useEffect(() => {
        const channel = supabase
            .channel('requisicoes_supplier_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'requisicoes'
                },
                (payload) => {
                    const next = (payload.new || {}) as Record<string, any>;
                    const requisicaoId = String(next.id || '');
                    if (!requisicaoId) return;

                    setRequisicoes(prev => prev.map(req => {
                        if (req.id !== requisicaoId) return req;

                        const supplierConfirmed = next.supplier_confirmed === null || next.supplier_confirmed === undefined
                            ? req.supplier_confirmed
                            : Boolean(next.supplier_confirmed);

                        const supplierRefusedRaw = next.supplier_refused ?? next.supplier_rejected;
                        const supplierRefused = supplierRefusedRaw === null || supplierRefusedRaw === undefined
                            ? (req.supplier_refused ?? req.supplier_rejected)
                            : Boolean(supplierRefusedRaw);

                        const supplierComment = typeof next.supplier_comment === 'string'
                            ? next.supplier_comment
                            : req.supplier_comment;

                        const supplierConfirmedAt = next.supplier_confirmed_at ?? req.supplier_confirmed_at;
                        const supplierRefusedAt = next.supplier_refused_at ?? req.supplier_refused_at;
                        const supplierResponseDate = next.supplier_response_date ?? req.supplier_response_date;

                        return {
                            ...req,
                            supplier_confirmed: supplierConfirmed,
                            supplier_refused: supplierRefused,
                            supplier_rejected: supplierRefused,
                            supplier_comment: supplierComment,
                            supplier_confirmed_at: supplierConfirmedAt,
                            supplier_refused_at: supplierRefusedAt,
                            supplier_response_date: supplierResponseDate
                        };
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updateRequisicao = async (r: Requisicao) => {
        const { error } = await supabase.from('requisicoes').update({
            data: r.data,
            tipo: r.tipo,
            cliente_id: r.clienteId || null,
            fornecedor_id: r.fornecedorId,
            viatura_id: r.viaturaId,
            centro_custo_id: r.centroCustoId,
            obs: r.obs || '',
            status: r.status,
            erp_status: r.erp_status,
            approved_value: r.approved_value ?? null,
            criado_por: r.criadoPor,
            supplier_confirmed: r.supplier_confirmed ?? false,
            supplier_confirmed_at: r.supplier_confirmed_at ?? null,
            supplier_refused: r.supplier_refused ?? r.supplier_rejected ?? false,
            supplier_refused_at: r.supplier_refused_at ?? null,
            supplier_rejected: r.supplier_rejected ?? r.supplier_refused ?? false,
            supplier_comment: r.supplier_comment ?? null,
            supplier_response_date: r.supplier_response_date ?? null,
            itens: r.itens
        }).eq('id', r.id);
        if (!error) setRequisicoes(prev => prev.map(curr => curr.id === r.id ? r : curr));
    };
    const deleteRequisicao = async (id: string) => {
        const { error } = await supabase.from('requisicoes').delete().eq('id', id);
        if (!error) setRequisicoes(prev => prev.filter(r => r.id !== id));
    };
    const toggleRequisicaoStatus = async (
        id: string,
        faturas?: {
            numero: string;
            valor_liquido: number;
            iva_taxa: number;
            iva_valor: number;
            valor_total: number;
        }[]
    ) => {

        const r = requisicoes.find(req => req.id === id);
        if (!r) return;

        const newStatus = r.status === 'concluida' ? 'pendente' : 'concluida';

        const updates: any = { status: newStatus };

        if (newStatus === 'concluida' && faturas && Array.isArray(faturas)) {

            // 🔥 Guardar JSON completo (CORRETO)
            updates.faturas_dados = faturas;

            // Apenas para compatibilidade (não usado no PDF principal)
            updates.fatura = faturas.map(f => f.numero).join(', ');

            // Soma total geral
            updates.custo = faturas.reduce(
                (sum, f) => sum + f.valor_total,
                0
            );

            const targetValue = Number(r.approved_value ?? updates.custo ?? 0) || (Array.isArray(r.itens)
                ? r.itens.reduce((sum, item) => {
                    const lineTotal = Number(item?.valor_total ?? 0);
                    if (Number.isFinite(lineTotal) && lineTotal > 0) return sum + lineTotal;
                    return sum + (Number(item?.quantidade ?? 0) * Number(item?.valor_unitario ?? 0));
                }, 0)
                : 0);

            updates.erp_status = updates.custo >= targetValue ? 'closed' : 'invoiced';

        } else {

            updates.fatura = "";
            updates.custo = null;
            updates.faturas_dados = null;
            updates.erp_status = newStatus === 'pendente' ? 'pending' : 'awaiting_invoice';
        }

        const { error } = await supabase
            .from('requisicoes')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error("ERRO SUPABASE:", error);
            alert("Erro ao confirmar requisição");
            return;
        }

        setRequisicoes(prev =>
            prev.map(req =>
                req.id === id
                    ? { ...req, ...updates }
                    : req
            )
        );

    };

    const addStockItem = async (item: Omit<import('../types').StockItem, 'id' | 'created_at' | 'updated_at'>) => {
        const stockTable = await resolveStockItemsTable();
        let { data, error } = await supabase
            .from(stockTable)
            .insert(item)
            .select('*, supplier:fornecedores(*)')
            .single();

        if (error && stockTable === 'stock_items' && isMissingStockTableError(error, 'stock_items')) {
            stockItemsTableRef.current = 'workshop_items';
            const fallback = await supabase
                .from('workshop_items')
                .insert(item)
                .select('*, supplier:fornecedores(*)')
                .single();
            data = fallback.data;
            error = fallback.error;
        }

        if (!error && data) {
            setStockItems(prev => [...prev, data as import('../types').StockItem]);
        } else if (error) {
            console.error('Error adding stock item:', error);
            alert('Erro ao adicionar item: ' + error.message);
        }
    };

    const updateStockItem = async (item: import('../types').StockItem) => {
        const stockTable = await resolveStockItemsTable();

        let { data, error } = await supabase.from(stockTable).update({
            name: item.name,
            sku: item.sku || null,
            category: item.category || null,
            stock_quantity: item.stock_quantity,
            minimum_stock: item.minimum_stock,
            average_cost: item.average_cost,
            location: item.location || null,
            supplier_id: item.supplier_id || null
        }).eq('id', item.id).select('*, supplier:fornecedores(*)').single();

        if (error && stockTable === 'stock_items' && isMissingStockTableError(error, 'stock_items')) {
            stockItemsTableRef.current = 'workshop_items';
            const fallback = await supabase.from('workshop_items').update({
                name: item.name,
                sku: item.sku || null,
                category: item.category || null,
                stock_quantity: item.stock_quantity,
                minimum_stock: item.minimum_stock,
                average_cost: item.average_cost,
                location: item.location || null,
                supplier_id: item.supplier_id || null
            }).eq('id', item.id).select('*, supplier:fornecedores(*)').single();
            error = fallback.error;
            data = fallback.data;
        }

        if (!error && data) {
            setStockItems(prev => prev.map(wi => wi.id === item.id ? (data as import('../types').StockItem) : wi));
        } else {
            console.error('Error updating stock item:', error);
            alert('Erro ao atualizar peça. Verifique as permissões ou se o item existe. ' + (error?.message || ''));
            // Optionally reload to revert UI state
        }
    };


    const deleteStockItem = async (id: string) => {
        const stockTable = await resolveStockItemsTable();
        let { error } = await supabase.from(stockTable).delete().eq('id', id);

        if (error && stockTable === 'stock_items' && isMissingStockTableError(error, 'stock_items')) {
            stockItemsTableRef.current = 'workshop_items';
            const fallback = await supabase.from('workshop_items').delete().eq('id', id);
            error = fallback.error;
        }

        if (!error) {
            setStockItems(prev => prev.filter(wi => wi.id !== id));
        } else {
            console.error('Error deleting stock item:', error);
            alert('Erro ao apagar item: ' + error.message);
        }
    };

    const createStockMovement = async (movement: Omit<import('../types').StockMovement, 'id' | 'created_at'>) => {
        const { data, error } = await supabase.from('stock_movements').insert({
            item_id: movement.item_id,
            movement_type: movement.movement_type,
            quantity: movement.quantity,
            average_cost_at_time: movement.average_cost_at_time,
            source_document: movement.source_document,
            document_id: movement.document_id,
            notes: movement.notes
        }).select('*').single();

        if (!error && data) {
            await refreshInventoryData();
        } else if (error) {
            console.error('Error creating stock movement:', error);
            alert('Erro ao registar movimento: ' + error.message);
        }
    };

    const refreshInventoryData = async () => {
        try {
            const stockTable = await resolveStockItemsTable();
            const { data: items } = await supabase.from(stockTable).select('*, supplier:fornecedores(*)');
            const normalizedItemsRaw = (items || []) as import('../types').StockItem[];

            const { data: movements } = await supabase
                .from('stock_movements')
                .select('*')
                .order('created_at', { ascending: false });

            const requisitionItemIds = new Set(
                (movements || [])
                    .filter((movement: any) => movement.source_document === 'requisition')
                    .map((movement: any) => String(movement.item_id))
            );

            const normalizedItems = normalizedItemsRaw.filter(item => {
                if (isRequisitionCategory(item.category)) return false;
                if (requisitionItemIds.has(String(item.id))) return false;
                return true;
            });

            setStockItems(normalizedItems);

            if (movements) {
                const itemById = new Map(normalizedItems.map(item => [String(item.id), item]));
                const visibleMovements = movements.filter((movement: any) => {
                    if (movement.source_document === 'requisition') return false;
                    if (requisitionItemIds.has(String(movement.item_id))) return false;
                    return true;
                });

                const enriched = visibleMovements.map((movement: any) => ({
                    ...movement,
                    item: itemById.get(String(movement.item_id))
                }));
                setStockMovements(enriched);
            }

            const { data: assets } = await supabase.from('workshop_assets').select('*');
            if (assets) setWorkshopAssets(assets);
        } catch (e) {
            console.error('Error refreshing inventory data:', e);
        }
    };

    const addWorkshopAsset = async (asset: Omit<import('../types').WorkshopAsset, 'id' | 'created_at' | 'updated_at'>) => {
        const { data, error } = await supabase.from('workshop_assets').insert(asset).select().single();
        if (!error && data) {
            setWorkshopAssets(prev => [...prev, data as import('../types').WorkshopAsset]);
        } else if (error) {
            console.error('Error adding workshop asset:', error);
            alert('Erro ao adicionar ativo: ' + error.message);
        }
    };

    const updateWorkshopAsset = async (asset: import('../types').WorkshopAsset) => {
        const { error } = await supabase.from('workshop_assets').update(asset).eq('id', asset.id);
        if (!error) {
            setWorkshopAssets(prev => prev.map(a => a.id === asset.id ? asset : a));
        } else {
            console.error('Error updating workshop asset:', error);
            alert('Erro ao atualizar ativo: ' + error.message);
        }
    };

    const deleteWorkshopAsset = async (id: string) => {
        const { error } = await supabase.from('workshop_assets').delete().eq('id', id);
        if (!error) {
            setWorkshopAssets(prev => prev.filter(a => a.id !== id));
        } else {
            console.error('Error deleting workshop asset:', error);
            alert('Erro ao apagar ativo: ' + error.message);
        }
    };

    const assignWorkshopAsset = async (assetId: string, technicianId: string | null) => {
        const status = technicianId ? 'assigned' : 'available';
        const { error } = await supabase.from('workshop_assets').update({
            assigned_technician_id: technicianId,
            status: status
        }).eq('id', assetId);

        if (!error) {
            setWorkshopAssets(prev => prev.map(a =>
                a.id === assetId ? { ...a, assigned_technician_id: technicianId, status: status } : a
            ));
        } else {
            console.error('Error assigning workshop asset:', error);
            alert('Erro ao atribuir ativo: ' + error.message);
        }
    };

    // Motoristas and others remain local for now as per plan focus
    const addMotorista = async (m: Motorista) => {
        const resolvedTipoUtilizador = m.tipoUtilizador || (m as any).tipo_utilizador || 'motorista';
        const payloadWithRole = {
            id: m.id,
            nome: m.nome,
            foto: m.foto,
            contacto: m.contacto,
            carta_conducao: m.cartaConducao,
            email: m.email,
            obs: m.obs,
            pin: m.pin,
            vencimento_base: m.vencimentoBase,
            valor_hora: m.valorHora,
            folgas: m.folgas,
            blocked_permissions: m.blockedPermissions,
            turno_inicio: m.turnoInicio,
            turno_fim: m.turnoFim,
            cartrack_key: m.cartrackKey,
            centro_custo_id: m.centroCustoId,
            shifts: m.shifts,
            zones: m.zones,
            blocked_periods: m.blockedPeriods,
            max_daily_services: m.maxDailyServices,
            min_interval_minutes: m.minIntervalMinutes,
            tipo_utilizador: resolvedTipoUtilizador,
            estado_operacional: m.estadoOperacional || 'disponivel'
        };

        let { error } = await supabase.from('motoristas').insert(payloadWithRole);

        if (error && isMissingTipoUtilizadorColumnError(error)) {
            if (resolvedTipoUtilizador !== 'motorista') {
                alert('A coluna tipo_utilizador ainda não existe na base de dados. Execute a migration para usar Supervisor/Oficina.');
                throw error;
            }
            const { tipo_utilizador, ...payloadWithoutRole } = payloadWithRole as any;
            ({ error } = await supabase.from('motoristas').insert(payloadWithoutRole));
        }

        if (!error) setMotoristas(prev => [...prev, m]);
    };
    const updateMotorista = async (m: Motorista) => {
        const resolvedTipoUtilizador = m.tipoUtilizador || (m as any).tipo_utilizador;
        const payloadWithRole = {
            nome: m.nome,
            foto: m.foto,
            contacto: m.contacto,
            carta_conducao: m.cartaConducao,
            email: m.email,
            obs: m.obs,
            pin: m.pin,
            vencimento_base: m.vencimentoBase,
            valor_hora: m.valorHora,
            folgas: m.folgas,
            blocked_permissions: m.blockedPermissions,
            turno_inicio: m.turnoInicio,
            turno_fim: m.turnoFim,
            cartrack_key: m.cartrackKey,
            centro_custo_id: m.centroCustoId,
            shifts: m.shifts,
            zones: m.zones,
            blocked_periods: m.blockedPeriods,
            max_daily_services: m.maxDailyServices,
            min_interval_minutes: m.minIntervalMinutes,
            estado_operacional: m.estadoOperacional || 'disponivel',
            ...(resolvedTipoUtilizador ? { tipo_utilizador: resolvedTipoUtilizador } : {})
        };

        let { error } = await supabase.from('motoristas').update(payloadWithRole).eq('id', m.id);

        if (error && isMissingTipoUtilizadorColumnError(error)) {
            if ((resolvedTipoUtilizador || 'motorista') !== 'motorista') {
                alert('A coluna tipo_utilizador ainda não existe na base de dados. Execute a migration para alterar a função.');
                throw error;
            }
            const { tipo_utilizador, ...payloadWithoutRole } = payloadWithRole as any;
            ({ error } = await supabase.from('motoristas').update(payloadWithoutRole).eq('id', m.id));
        }

        if (error) {
            console.error("Erro ao atualizar motorista:", error);
            alert(`Erro ao atualizar: ${error.message}`);
            throw error;
        }

        const { data: verify } = await supabase.from('motoristas').select('id').eq('id', m.id).single();
        if (!verify) {
            alert('Aviso: A atualização parece não ter sido persistida. Verifique as permissões.');
        }

        // Force full refresh to ensure all enrichments (currentVehicle, status) are re-calculated correctly and persistence is confirmed
        await refreshData();
    };
    const deleteMotorista = async (id: string) => {
        const { error, count } = await supabase.from('motoristas').delete({ count: 'exact' }).eq('id', id);
        if (error) {
            console.error('Error deleting motorista:', error);
            alert(`Erro ao apagar: ${error.message}`);
        } else if (count === 0) {
            console.warn('Delete count 0 - likely RLS issue');
            alert('Aviso: Não foi possível apagar o registo (permissões insuficientes ou registo já apagado).');
        } else {
            setMotoristas(prev => prev.filter(m => m.id !== id));
        }
    };

    const addSupervisor = async (s: Supervisor) => {
        const { error } = await supabase.from('supervisores').insert({
            id: s.id,
            nome: s.nome,
            foto: s.foto,
            email: s.email,
            telemovel: s.telemovel,
            pin: s.pin,
            password: s.password,
            status: s.status,
            blocked_permissions: s.blockedPermissions
        });
        if (error) throw error; // Propagate error
        setSupervisors(prev => [...prev, s]);
    };
    const updateSupervisor = async (s: Supervisor) => {
        const { error } = await supabase.from('supervisores').update({
            nome: s.nome,
            foto: s.foto,
            email: s.email,
            telemovel: s.telemovel,
            pin: s.pin,
            password: s.password,
            status: s.status,
            blocked_permissions: s.blockedPermissions
        }).eq('id', s.id);
        if (!error) setSupervisors(prev => prev.map(curr => curr.id === s.id ? s : curr));
    };
    const deleteSupervisor = async (id: string) => {
        const { error } = await supabase.from('supervisores').delete().eq('id', id);
        if (!error) setSupervisors(prev => prev.filter(s => s.id !== id));
    };

    const addGestor = async (g: Gestor) => {
        const { error } = await supabase.from('gestores').insert({
            id: g.id,
            nome: g.nome,
            foto: g.foto,
            email: g.email,
            telemovel: g.telemovel,
            pin: g.pin,
            password: g.password,
            status: g.status,
            blocked_permissions: g.blockedPermissions,
            data_registo: new Date().toISOString()
        });
        if (error) throw error; // Propagate error
        setGestores(prev => [...prev, g]);
    };

    const updateGestor = async (g: Gestor) => {
        const { error } = await supabase.from('gestores').update({
            nome: g.nome,
            foto: g.foto,
            email: g.email,
            telemovel: g.telemovel,
            pin: g.pin,
            password: g.password,
            status: g.status,
            blocked_permissions: g.blockedPermissions
        }).eq('id', g.id);
        if (!error) setGestores(prev => prev.map(curr => curr.id === g.id ? g : curr));
    };
    const deleteGestor = async (id: string) => {
        const { error } = await supabase.from('gestores').delete().eq('id', id);
        if (!error) setGestores(prev => prev.filter(g => g.id !== id));
    };

    const addOficinaUser = async (u: OficinaUser) => {
        const { error } = await supabase.from('oficina_users').insert({
            id: u.id,
            nome: u.nome,
            foto: u.foto,
            email: u.email,
            telemovel: u.telemovel,
            pin: u.pin,
            status: u.status,
            blocked_permissions: u.blockedPermissions
        });
        if (error) {
            console.error('Error adding Oficina User:', error);
            return { error };
        }
        setOficinaUsers(prev => [...prev, u]);
        return { error: null };
    };
    const updateOficinaUser = async (u: OficinaUser) => {
        const { error } = await supabase.from('oficina_users').update({
            nome: u.nome,
            foto: u.foto,
            email: u.email,
            telemovel: u.telemovel, // NEW
            pin: u.pin,
            status: u.status,
            blocked_permissions: u.blockedPermissions
        }).eq('id', u.id);
        if (!error) setOficinaUsers(prev => prev.map(curr => curr.id === u.id ? u : curr));
    };
    const deleteOficinaUser = async (id: string) => {
        const { error } = await supabase.from('oficina_users').delete().eq('id', id);
        if (!error) setOficinaUsers(prev => prev.filter(u => u.id !== id));
    };

    const addNotification = async (n: Notification) => {
        const { error } = await supabase.from('notifications').insert({
            id: n.id,
            type: n.type,
            data: n.data,
            status: n.status,
            response: n.response,
            timestamp: n.timestamp
        });
        if (!error) setNotifications(prev => [n, ...prev]);
    };
    const updateNotification = async (n: Notification) => {
        const { error } = await supabase.from('notifications').update({
            type: n.type,
            data: n.data,
            status: n.status,
            response: n.response,
            timestamp: n.timestamp
        }).eq('id', n.id);
        if (!error) {
            setNotifications(prev => prev.map(current => current.id === n.id ? n : current));
        }
        return { error };
    };

    const addCentroCusto = async (cc: CentroCusto) => {
        const { error } = await supabase.from('centros_custos').insert(cc);
        if (!error) setCentrosCustos(prev => [...prev, cc]);
    };
    const deleteCentroCusto = async (id: string) => {
        const { error } = await supabase.from('centros_custos').delete().eq('id', id);
        if (!error) setCentrosCustos(prev => prev.filter(c => c.id !== id));
    };

    const addEvaTransport = async (t: EvaTransport) => {
        // Insert Parent
        const { error: parentError } = await supabase.from('eva_transports').insert({
            id: t.id,
            reference_date: t.referenceDate,
            route: t.route,
            amount: t.amount,
            notes: t.notes,
            logged_by: t.loggedBy,
            created_at: t.createdAt
            // year/month handled by DB triggers/defaults or could calculate here
        });

        if (parentError) {
            console.error('Error adding Eva Transport:', parentError);
            return;
        }

        // Insert Children
        if (t.days.length > 0) {
            const daysToInsert = t.days.map(d => ({
                id: d.id,
                transport_id: t.id,
                date: d.date,
                has_issue: d.hasIssue,
                issue_type: d.issueType,
                issue_description: d.issueDescription,
                issue_severity: d.issueSeverity
            }));
            const { error: daysError } = await supabase.from('eva_transport_days').insert(daysToInsert);
            if (daysError) console.error('Error adding Eva Days:', daysError);
        }

        setEvaTransports(prev => [t, ...prev]);
    };

    const deleteEvaTransport = async (id: string) => {
        const { error } = await supabase.from('eva_transports').delete().eq('id', id);
        if (!error) setEvaTransports(prev => prev.filter(t => t.id !== id));
    };


    const createAdminUser = async (email: string, password: string, nome: string) => {
        try {
            // Create a temporary client to avoid signing out the current user
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false } }
            );

            const { data, error } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/`,
                }
            });

            if (error) return { success: false, error: error.message };

            if (data.user) {
                // Insert into admin_users using the MAIN authenticated client (which has permission)
                const { error: dbError } = await supabase.from('admin_users').insert({
                    id: data.user.id,
                    email: email,
                    nome: nome,
                    role: 'admin'
                });

                if (dbError) {
                    // Rollback logic could be here (delete user), but let's just report error
                    console.error('Error inserting admin_user:', dbError);
                    return { success: true, error: 'User created in Auth but DB insert failed. ' + dbError.message };
                }

                // Refresh logic
                const { data: a } = await supabase.from('admin_users').select('*').eq('id', data.user.id).single();
                if (a) {
                    setAdminUsers(prev => [...prev, {
                        id: a.id,
                        email: a.email,
                        nome: a.nome,
                        role: a.role,
                        createdAt: a.created_at
                    }]);
                }
                return { success: true };
            }
            return { success: false, error: 'Unknown error during sign up.' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    };

    const deleteAdminUser = async (id: string) => {
        // Note: We can only delete from list. Deleting from Auth requires Service Role (backend).
        // So we just remove from the list table. The Auth user remains but has no "admin" entry.
        const { error } = await supabase.from('admin_users').delete().eq('id', id);
        if (!error) setAdminUsers(prev => prev.filter(u => u.id !== id));
    };

    const addAvaliacao = async (avaliacao: Avaliacao) => {
        const { data, error } = await supabase.from('avaliacoes').insert([{
            motorista_id: avaliacao.motoristaId,
            admin_id: avaliacao.adminId,
            periodo: avaliacao.periodo,
            pontuacao: avaliacao.pontuacao,
            criterios: avaliacao.criterios,
            obs: avaliacao.obs,
            data_avaliacao: avaliacao.dataAvaliacao
        }]).select().single();

        if (!error && data) {
            setAvaliacoes(prev => [...prev, {
                ...avaliacao,
                id: data.id
            }]);
        } else if (error) {
            console.error('Error adding avaliacao:', error);
        }
    };

    const updateGeofenceMapping = async (geofenceName: string, centroCustoId: string) => {
        try {
            const { error } = await supabase
                .from('cartrack_geofence_mappings')
                .upsert({ geofence_name: geofenceName, centro_custo_id: centroCustoId });

            if (error) throw error;
            setGeofenceMappings(prev => ({ ...prev, [geofenceName]: centroCustoId }));
        } catch (e) {
            console.error('Error updating geofence mapping:', e);
        }
    };

    const getVehicleOccupancyHistory = async (vehicleId: string, startDate: string, endDate: string) => {
        try {
            // 1. Get Geofence Visits
            const visits = await CartrackService.getGeofenceVisits(startDate, endDate, vehicleId);

            // 2. Generate days map
            const start = new Date(startDate);
            const end = new Date(endDate);
            const occupancy: Record<string, { centroCustoId: string | null; duration: number; visitedCCs: Set<string> }> = {};

            // Initialize days
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                occupancy[d.toISOString().split('T')[0]] = { centroCustoId: null, duration: 0, visitedCCs: new Set() };
            }

            // 3. Attribute visits to days
            visits.forEach(visit => {
                const ccId = geofenceMappings[visit.geofenceName];
                if (!ccId) return;

                const entry = new Date(visit.entryTime);
                const exit = visit.exitTime ? new Date(visit.exitTime) : new Date();

                // For each day the visit spans
                const current = new Date(entry);
                while (current <= exit) {
                    const dayKey = current.toISOString().split('T')[0];
                    if (occupancy[dayKey]) {
                        // Calculate duration on this specific day
                        const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
                        const dayEnd = new Date(current); dayEnd.setHours(23, 59, 59, 999);

                        const overlapStart = entry > dayStart ? entry : dayStart;
                        const overlapEnd = exit < dayEnd ? exit : dayEnd;

                        const durationInMinutes = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / 60000);

                        // If the presence is significant (> 1 minute), add this CC to the day's record
                        if (durationInMinutes > 1) {
                            occupancy[dayKey].visitedCCs.add(ccId);
                        }
                    }
                    // Move to next day (ensuring we cross midnight correctly)
                    current.setDate(current.getDate() + 1);
                    current.setHours(0, 0, 0, 0);
                }
            });

            const results: { date: string; centroCustoId: string | null }[] = [];
            Object.entries(occupancy).forEach(([date, data]) => {
                const ccs = Array.from(data.visitedCCs);
                if (ccs.length === 0) {
                    results.push({ date, centroCustoId: null });
                } else {
                    ccs.forEach(ccId => {
                        results.push({ date, centroCustoId: ccId });
                    });
                }
            });

            return results;

        } catch (e) {
            console.error('Error calculating occupancy:', e);
            return [];
        }
    };

    const syncRealTimeRentals = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const activeVehicles = cartrackVehicles.filter(v => v.currentCentroCustoId);

            if (activeVehicles.length === 0) return;

            for (const v of activeVehicles) {
                const viatura = viaturas.find(vit => vit.matricula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === v.registration.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
                if (!viatura || !v.currentCentroCustoId) continue;

                // Check if a record already exists for this vehicle + CC + date
                const { data: existing } = await supabase
                    .from('faturas')
                    .select('id')
                    .eq('tipo', 'aluguer')
                    .eq('data', today)
                    .contains('aluguer_details', {
                        viaturaId: viatura.id,
                        centroCustoId: v.currentCentroCustoId
                    })
                    .limit(1);

                if (existing && existing.length > 0) {
                    console.log(`Skipping auto-sync for ${v.registration}: already exists.`);
                    continue;
                }

                const precoDia = viatura.precoDiario || 0;

                const rentalData = {
                    numero: `AUTO-${today.replace(/-/g, '')}-${v.registration.replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`,
                    data: today,
                    vencimento: today,
                    clienteId: null, // Set to null for internal auto-sync to avoid FKEY issues
                    status: 'emitida',
                    subtotal: precoDia,
                    imposto: precoDia * 0.23,
                    desconto: 0,
                    total: precoDia * 1.23,
                    tipo: 'aluguer',
                    aluguerDetails: {
                        viaturaId: viatura.id,
                        viaturasIds: [viatura.id],
                        viaturas: [{
                            viaturaId: viatura.id,
                            dias: 1,
                            dataInicio: today,
                            dataFim: today,
                            precoDia,
                            total: precoDia,
                            centroCustoId: v.currentCentroCustoId
                        }],
                        dias: 1,
                        dataInicio: today,
                        dataFim: today,
                        centroCustoId: v.currentCentroCustoId,
                        detalhesViaturas: [{
                            viaturaId: viatura.id,
                            dias: 1,
                            dataInicio: today,
                            dataFim: today,
                            precoDia,
                            total: precoDia,
                            precoDiario: precoDia,
                            centroCustoId: v.currentCentroCustoId
                        }]
                    }
                };

                const { error } = await supabase.from('faturas').insert(rentalData);
                if (error) console.error('Error auto-syncing rental:', error);
            }
            // Trigger a data refresh after sync
            await refreshData();
        } catch (e) {
            console.error('Auto-sync failed:', e);
        }
    };

    const autoConfirmServiceArrivals = async (vehicleSnapshot?: import('../services/cartrack').CartrackVehicle[]) => {
        if (!supportsServiceGeofencingColumnsRef.current) return;
        if (autoGeofenceSyncRunningRef.current) return;

        const MIN_GEOFENCE_RADIUS_METERS = 80;
        const MIN_HOTEL_GEOFENCE_RADIUS_METERS = 100;
        const SCHEDULED_MONITOR_LEAD_MINUTES = 10;
        const STOP_SPEED_THRESHOLD_KMH = 5;
        const MIN_STOP_DURATION_SECONDS = 30;

        const pendingServices = servicos.filter((s: Servico) =>
            !!s.motoristaId && (String(s.status || '').toUpperCase() !== 'COMPLETED' || !s.concluido)
        );

        if (pendingServices.length === 0 || locais.length === 0) return;

        autoGeofenceSyncRunningRef.current = true;

        try {
            const normalizePlate = (plate?: string | null) => (plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const nowIso = new Date().toISOString();
            const nowTs = new Date(nowIso).getTime();

            const isInsideLocation = (
                vehicle: import('../services/cartrack').CartrackVehicle,
                location: Local | null,
                previous?: { latitude: number; longitude: number } | null
            ) => {
                if (!location) return { inside: false, crossed: false, distance: Infinity, radius: 0 };

                const segmentIntersectsCircle = (
                    prevLat: number,
                    prevLng: number,
                    currLat: number,
                    currLng: number,
                    centerLat: number,
                    centerLng: number,
                    radiusMeters: number
                ) => {
                    const meanLatRad = ((centerLat + currLat + prevLat) / 3) * Math.PI / 180;
                    const metersPerDegLat = 111320;
                    const metersPerDegLng = 111320 * Math.cos(meanLatRad);

                    const px = (prevLng - centerLng) * metersPerDegLng;
                    const py = (prevLat - centerLat) * metersPerDegLat;
                    const qx = (currLng - centerLng) * metersPerDegLng;
                    const qy = (currLat - centerLat) * metersPerDegLat;

                    const dx = qx - px;
                    const dy = qy - py;
                    const denom = (dx * dx) + (dy * dy);

                    if (denom === 0) {
                        return (px * px + py * py) <= (radiusMeters * radiusMeters);
                    }

                    const t = Math.max(0, Math.min(1, -((px * dx) + (py * dy)) / denom));
                    const cx = px + t * dx;
                    const cy = py + t * dy;
                    return (cx * cx + cy * cy) <= (radiusMeters * radiusMeters);
                };

                const distance = getDistance(vehicle.latitude, vehicle.longitude, location.latitude, location.longitude);
                const minRadius = location.tipo === 'hotel'
                    ? MIN_HOTEL_GEOFENCE_RADIUS_METERS
                    : MIN_GEOFENCE_RADIUS_METERS;
                const radius = Math.max(Number(location.raio || 0), minRadius);
                const inside = distance <= radius;
                const crossed = Boolean(
                    previous && segmentIntersectsCircle(
                        previous.latitude,
                        previous.longitude,
                        vehicle.latitude,
                        vehicle.longitude,
                        location.latitude,
                        location.longitude,
                        radius
                    )
                );

                return { inside, crossed, distance, radius };
            };

            const currentEventsByService = serviceEvents.reduce((acc, event) => {
                const key = String(event.serviceId || '');
                if (!key) return acc;
                const list = acc.get(key) || [];
                list.push(event);
                acc.set(key, list);
                return acc;
            }, new Map<string, ServiceEvent[]>());

            const existingAlertKeys = new Set(
                notifications
                    .filter(n => n.type === 'system_alert')
                    .map(n => String(n.data?.requestId || ''))
                    .filter(Boolean)
            );

            const vehicles = (vehicleSnapshot && vehicleSnapshot.length > 0)
                ? vehicleSnapshot
                : await CartrackService.getVehicles();

            const prevPositions = prevVehiclePositionsRef.current;

            const activeSessionsByDriver = driverVehicleSessions.reduce((acc, session) => {
                if (session.active && session.driverId && session.vehicleId && !acc.has(session.driverId)) {
                    acc.set(session.driverId, session.vehicleId);
                }
                return acc;
            }, new Map<string, string>());

            if (!vehicleSnapshot && vehicles.length > 0) {
                setCartrackVehicles(vehicles);
            }

            const updates: Array<{ serviceId: string; payload: any; partial: Partial<Servico> }> = [];
            const eventsToInsert: Array<{ service_id: string; vehicle_id: string; event_type: string; timestamp: string; location_id: string | null; metadata?: any }> = [];
            const alertsToCreate: Notification[] = [];

            const queueAlert = (service: Servico, keySuffix: string, title: string, message: string, priority: 'normal' | 'high' = 'high') => {
                const requestId = `${service.id}:${keySuffix}`;
                if (existingAlertKeys.has(requestId)) return;
                existingAlertKeys.add(requestId);
                alertsToCreate.push({
                    id: crypto.randomUUID(),
                    type: 'system_alert',
                    data: {
                        title,
                        message,
                        priority,
                        serviceId: service.id,
                        requestId
                    },
                    status: 'pending',
                    timestamp: nowIso
                });
            };

            const queueEvent = (
                serviceId: string,
                vehicleId: string,
                eventType: string,
                eventTimestamp: string,
                locationId?: string | null,
                metadata?: any
            ) => {
                const existingForService = currentEventsByService.get(serviceId) || [];
                const alreadyExists = existingForService.some(event =>
                    event.eventType === eventType &&
                    String(event.locationId || '') === String(locationId || '')
                );

                const alreadyQueued = eventsToInsert.some(event =>
                    event.service_id === serviceId &&
                    event.event_type === eventType &&
                    String(event.location_id || '') === String(locationId || '')
                );

                if (alreadyExists || alreadyQueued) return;

                eventsToInsert.push({
                    service_id: serviceId,
                    vehicle_id: vehicleId,
                    event_type: eventType,
                    timestamp: eventTimestamp,
                    location_id: locationId || null,
                    metadata
                });
            };

            for (const service of pendingServices) {
                const motorista = motoristas.find(m => m.id === service.motoristaId);
                if (!motorista) continue;

                const sessionVehicleId = await getVehicleByDriver(motorista.id, activeSessionsByDriver);

                const vehicle = vehicles.find(v =>
                    (sessionVehicleId && String(v.id) === String(sessionVehicleId)) ||
                    (motorista.cartrackId && String(v.id) === String(motorista.cartrackId)) ||
                    (motorista.currentVehicle && normalizePlate(v.registration) === normalizePlate(motorista.currentVehicle))
                );

                if (!vehicle || !vehicle.latitude || !vehicle.longitude) continue;

                const previousPosition = prevPositions[String(vehicle.id)]
                    ? {
                        latitude: prevPositions[String(vehicle.id)].latitude,
                        longitude: prevPositions[String(vehicle.id)].longitude
                    }
                    : null;

                const originLocation = resolveLocationByName(service.origem, service.originLocationId);
                const destinationLocation = resolveLocationByName(service.destino, service.destinationLocationId);

                const payload: any = {};
                const partial: Partial<Servico> = {};

                const originConfirmed = Boolean(service.originConfirmed || service.originArrivalTime);
                const destinationConfirmed = Boolean(service.destinationConfirmed || service.destinationArrivalTime);
                const serviceDateTime = parseServiceDateTime(service.data, service.hora);
                const lifecycleStatus = deriveServiceLifecycleStatus({
                    motoristaId: service.motoristaId,
                    serviceDate: service.data,
                    serviceHour: service.hora,
                    originConfirmed,
                    originDepartureTime: service.originDepartureTime,
                    destinationConfirmed,
                    nowTs
                });

                if (service.status !== lifecycleStatus) {
                    payload.status = lifecycleStatus;
                    partial.status = lifecycleStatus;
                }

                if (lifecycleStatus === 'COMPLETED' && !service.concluido) {
                    payload.concluido = true;
                    partial.concluido = true;
                }

                const shouldMonitorScheduled = Boolean(
                    lifecycleStatus === 'SCHEDULED' &&
                    serviceDateTime &&
                    nowTs >= (serviceDateTime.getTime() - (SCHEDULED_MONITOR_LEAD_MINUTES * 60 * 1000))
                );

                if (!['DRIVER_ASSIGNED', 'EN_ROUTE_ORIGIN', 'ARRIVED_ORIGIN', 'BOARDING', 'EN_ROUTE_DESTINATION'].includes(lifecycleStatus) && !shouldMonitorScheduled) {
                    if (Object.keys(payload).length > 0) {
                        updates.push({ serviceId: service.id, payload, partial });
                    }
                    continue;
                }

                const originState = isInsideLocation(vehicle, originLocation, previousPosition);
                const destinationState = isInsideLocation(vehicle, destinationLocation, previousPosition);
                const positionTimestamp = vehicle.last_position_update && !Number.isNaN(new Date(vehicle.last_position_update).getTime())
                    ? new Date(vehicle.last_position_update).toISOString()
                    : nowIso;
                const currentSpeed = Number(vehicle.speed || 0);
                const baseGpsMetadata = {
                    latitude: vehicle.latitude,
                    longitude: vehicle.longitude,
                    gps_timestamp: positionTimestamp,
                    speed_kmh: currentSpeed
                };

                let nextOperationalStatus = lifecycleStatus;

                if (service.motoristaId && nextOperationalStatus === 'DRIVER_ASSIGNED' && currentSpeed > 0 && originState.distance > 150) {
                    nextOperationalStatus = 'EN_ROUTE_ORIGIN';
                }

                if (originLocation && !service.originLocationId) {
                    payload.origem_location_id = originLocation.id;
                    partial.originLocationId = originLocation.id;
                }

                if (destinationLocation && !service.destinationLocationId) {
                    payload.destino_location_id = destinationLocation.id;
                    partial.destinationLocationId = destinationLocation.id;
                }

                if (originLocation && !originConfirmed && !originState.inside && originState.distance <= (originState.radius + 100)) {
                    queueEvent(service.id, String(vehicle.id), 'approaching_origin', positionTimestamp, originLocation.id, {
                        ...baseGpsMetadata,
                        distance_meters: Math.round(originState.distance)
                    });
                }

                if (originLocation && !originConfirmed && (originState.inside || originState.crossed)) {
                    if (!service.originArrivalTime) {
                        payload.origin_arrival_time = positionTimestamp;
                        partial.originArrivalTime = positionTimestamp;
                    }
                    payload.origin_confirmed = true;
                    partial.originConfirmed = true;
                    queueEvent(service.id, String(vehicle.id), 'entered_origin', positionTimestamp, originLocation.id, {
                        ...baseGpsMetadata,
                        distance_meters: Math.round(originState.distance),
                        crossed_by_path: Boolean(originState.crossed && !originState.inside)
                    });
                    nextOperationalStatus = 'ARRIVED_ORIGIN';
                }

                const isInsideOriginNow = originState.inside || originState.crossed;
                const lowSpeedKey = service.id;

                if (originLocation && (originConfirmed || partial.originConfirmed) && isInsideOriginNow) {
                    if (currentSpeed < STOP_SPEED_THRESHOLD_KMH) {
                        if (!lowSpeedStartByServiceRef.current[lowSpeedKey]) {
                            lowSpeedStartByServiceRef.current[lowSpeedKey] = nowTs;
                        } else {
                            const stoppedSeconds = Math.max(0, Math.round((nowTs - lowSpeedStartByServiceRef.current[lowSpeedKey]) / 1000));
                            if (stoppedSeconds >= MIN_STOP_DURATION_SECONDS) {
                                partial.originStopDurationSeconds = stoppedSeconds;
                            }
                            if (currentSpeed < 3 && stoppedSeconds >= 20) {
                                nextOperationalStatus = 'BOARDING';
                            }
                        }
                    } else {
                        delete lowSpeedStartByServiceRef.current[lowSpeedKey];
                    }

                    if (nextOperationalStatus !== 'BOARDING') {
                        nextOperationalStatus = 'ARRIVED_ORIGIN';
                    }
                }

                if (originLocation && originConfirmed && !service.originDepartureTime && !originState.inside) {
                    payload.origin_departure_time = nowIso;
                    partial.originDepartureTime = nowIso;
                    queueEvent(service.id, String(vehicle.id), 'left_origin', positionTimestamp, originLocation.id, {
                        ...baseGpsMetadata,
                        distance_meters: Math.round(originState.distance)
                    });

                    if (service.originArrivalTime) {
                        const trackedLowSpeedStart = lowSpeedStartByServiceRef.current[lowSpeedKey];
                        const stopDurationSeconds = trackedLowSpeedStart
                            ? Math.max(0, Math.round((nowTs - trackedLowSpeedStart) / 1000))
                            : Math.max(0, Math.round((nowTs - new Date(service.originArrivalTime).getTime()) / 1000));
                        partial.originStopDurationSeconds = stopDurationSeconds;
                        if (stopDurationSeconds < MIN_STOP_DURATION_SECONDS) {
                            queueAlert(
                                service,
                                'short_origin_stop',
                                'Paragem demasiado curta',
                                `Serviço ${service.hora} • ${service.origem}: tempo parado inferior a 30s.`
                            );
                        }
                    }
                    delete lowSpeedStartByServiceRef.current[lowSpeedKey];

                    if (currentSpeed > 10) {
                        nextOperationalStatus = 'EN_ROUTE_DESTINATION';
                    }
                }

                if (destinationLocation && !destinationConfirmed && (destinationState.inside || destinationState.crossed)) {
                    if (!service.destinationArrivalTime) {
                        payload.destination_arrival_time = positionTimestamp;
                        partial.destinationArrivalTime = positionTimestamp;
                    }
                    payload.destination_confirmed = true;
                    partial.destinationConfirmed = true;
                    payload.status = 'COMPLETED';
                    payload.concluido = true;
                    partial.status = 'COMPLETED';
                    partial.concluido = true;
                    nextOperationalStatus = 'COMPLETED';
                    queueEvent(service.id, String(vehicle.id), 'entered_destination', positionTimestamp, destinationLocation.id, {
                        ...baseGpsMetadata,
                        distance_meters: Math.round(destinationState.distance),
                        crossed_by_path: Boolean(destinationState.crossed && !destinationState.inside)
                    });

                    if (!originConfirmed && !partial.originConfirmed) {
                        queueAlert(
                            service,
                            'destination_without_origin',
                            'Serviço executado sem passar pela origem',
                            `O serviço ${service.hora} chegou ao destino (${service.destino}) sem confirmação de origem.`
                        );
                    }
                }

                if (nextOperationalStatus !== (payload.status || lifecycleStatus)) {
                    payload.status = nextOperationalStatus;
                    partial.status = nextOperationalStatus;
                }

                if (destinationLocation && destinationConfirmed && !service.destinationDepartureTime && !destinationState.inside) {
                    payload.destination_departure_time = nowIso;
                    partial.destinationDepartureTime = nowIso;
                    queueEvent(service.id, String(vehicle.id), 'left_destination', positionTimestamp, destinationLocation.id, {
                        ...baseGpsMetadata,
                        distance_meters: Math.round(destinationState.distance)
                    });
                }

                if (serviceDateTime && !originConfirmed) {
                    const diffMinutes = (serviceDateTime.getTime() - nowTs) / 60000;
                    if (diffMinutes >= 0 && diffMinutes <= 5) {
                        queueAlert(
                            service,
                            'possible_delay',
                            'POSSÍVEL ATRASO',
                            `Faltam menos de 5 minutos para ${service.hora} e a origem ainda não foi confirmada.`
                        );
                    }

                    if (diffMinutes < -15) {
                        queueAlert(
                            service,
                            'origin_not_visited',
                            'Origem não confirmada',
                            `Serviço ${service.hora} concluído/expirado sem confirmação de passagem na origem.`
                        );
                    }
                }

                if (Object.keys(payload).length > 0) {
                    updates.push({ serviceId: service.id, payload, partial });
                }
            }

            const nextVehiclePositions: Record<string, { latitude: number; longitude: number; timestamp: string }> = { ...prevPositions };
            vehicles.forEach(vehicle => {
                if (!vehicle?.id || !vehicle?.latitude || !vehicle?.longitude) return;
                nextVehiclePositions[String(vehicle.id)] = {
                    latitude: Number(vehicle.latitude),
                    longitude: Number(vehicle.longitude),
                    timestamp: vehicle.last_position_update || nowIso
                };
            });
            prevVehiclePositionsRef.current = nextVehiclePositions;

            if (eventsToInsert.length > 0 && supportsServiceEventsTableRef.current) {
                const { data: insertedEvents, error: eventsError } = await supabase
                    .from('service_events')
                    .insert(eventsToInsert)
                    .select('*');

                if (eventsError) {
                    const message = String(eventsError?.message || eventsError?.details || '').toLowerCase();
                    if (message.includes('service_events') && (message.includes('does not exist') || message.includes('schema cache'))) {
                        supportsServiceEventsTableRef.current = false;
                    } else {
                        console.error('Erro ao gravar eventos de serviço:', eventsError);
                    }
                } else if (insertedEvents && insertedEvents.length > 0) {
                    const mappedInserted = insertedEvents.map((event: any) => ({
                        id: event.id,
                        serviceId: event.service_id,
                        vehicleId: event.vehicle_id,
                        eventType: event.event_type,
                        timestamp: event.timestamp,
                        locationId: event.location_id,
                        metadata: event.metadata
                    } as ServiceEvent));
                    setServiceEvents(prev => [...prev, ...mappedInserted]);
                }
            }

            if (alertsToCreate.length > 0) {
                await Promise.all(alertsToCreate.map(alert => addNotification(alert)));
            }

            if (updates.length === 0) return;

            const applied: Record<string, Partial<Servico>> = {};

            for (const update of updates) {
                const { error } = await supabase
                    .from('servicos')
                    .update(update.payload)
                    .eq('id', update.serviceId);

                if (!error) {
                    applied[update.serviceId] = update.partial;
                } else {
                    if (isMissingServiceGeofencingColumnError(error)) {
                        supportsServiceGeofencingColumnsRef.current = false;
                        break;
                    }
                    console.error('Erro ao confirmar chegada automática:', update.serviceId, error);
                }
            }

            if (Object.keys(applied).length > 0) {
                setServicos(prev => prev.map((service: Servico) => {
                    const servicePatch = applied[service.id];
                    if (!servicePatch) return service;
                    const originArrival = servicePatch.originArrivalTime ?? service.originArrivalTime;
                    const originDeparture = servicePatch.originDepartureTime ?? service.originDepartureTime;
                    const stopDuration = (servicePatch.originStopDurationSeconds !== undefined)
                        ? servicePatch.originStopDurationSeconds
                        : (originArrival && originDeparture
                            ? Math.max(0, Math.round((new Date(originDeparture).getTime() - new Date(originArrival).getTime()) / 1000))
                            : null);
                    return { ...service, ...servicePatch, originStopDurationSeconds: stopDuration };
                }));
            }
        } catch (error) {
            console.error('Erro no auto geofencing Cartrack:', error);
        } finally {
            autoGeofenceSyncRunningRef.current = false;
        }
    };

    // Auto-sync effect
    useEffect(() => {
        const interval = setInterval(() => {
            syncRealTimeRentals();
        }, 15 * 60 * 1000); // 15 minutes
        return () => clearInterval(interval);
    }, [cartrackVehicles, viaturas]);

    useEffect(() => {
        autoConfirmServiceArrivals(cartrackVehicles);
    }, [cartrackVehicles, servicos, motoristas, locais]);

    useEffect(() => {
        const hasPending = servicos.some((s: Servico) =>
            !!s.motoristaId && !s.concluido
        );

        if (!hasPending) return;

        const pollCartrackAndConfirm = async () => {
            try {
                if (typeof document !== 'undefined' && document.hidden) return;
                const vehicles = await CartrackService.getVehicles();
                if (vehicles.length > 0) {
                    setCartrackVehicles(vehicles);
                    await autoConfirmServiceArrivals(vehicles);
                }
            } catch (error) {
                console.warn('Falha no polling Cartrack para geofencing:', error);
            }
        };

        pollCartrackAndConfirm();
        const interval = setInterval(pollCartrackAndConfirm, 20 * 1000);
        return () => clearInterval(interval);
    }, [servicos, motoristas, locais]);

    // NEW: Zonas Operacionais Methods
    const addZonaOperacional = async (z: Omit<ZonaOperacional, 'id' | 'created_at'>) => {
        const { data, error } = await supabase.from('zonas_operacionais').insert(z).select().single();
        if (!error && data) {
            setZonasOperacionais(prev => [...prev, data as ZonaOperacional]);
        } else if (error) {
            console.error('Error adding zona operacional:', error);
        }
    };

    const updateZonaOperacional = async (z: ZonaOperacional) => {
        const { error } = await supabase.from('zonas_operacionais').update(z).eq('id', z.id);
        if (!error) {
            setZonasOperacionais(prev => prev.map(item => item.id === z.id ? z : item));
        } else {
            console.error('Error updating zona operacional:', error);
        }
    };

    const deleteZonaOperacional = async (id: string) => {
        const { error } = await supabase.from('zonas_operacionais').delete().eq('id', id);
        if (!error) {
            setZonasOperacionais(prev => prev.filter(z => z.id !== id));
        } else {
            console.error('Error deleting zona operacional:', error);
        }
    };

    const addAreaOperacional = async (a: Omit<AreaOperacional, 'id' | 'created_at'>) => {
        const { data, error } = await supabase.from('areas_operacionais').insert(a).select().single();
        if (!error && data) {
            setAreasOperacionais(prev => [...prev, data as AreaOperacional]);
        } else if (error) {
            console.error('Error adding area operacional:', error);
        }
    };

    const updateAreaOperacional = async (a: AreaOperacional) => {
        const { error } = await supabase.from('areas_operacionais').update(a).eq('id', a.id);
        if (!error) {
            setAreasOperacionais(prev => prev.map(item => item.id === a.id ? a : item));
        } else {
            console.error('Error updating area operacional:', error);
        }
    };

    const deleteAreaOperacional = async (id: string) => {
        const { error } = await supabase.from('areas_operacionais').delete().eq('id', id);
        if (!error) {
            setAreasOperacionais(prev => prev.filter(a => a.id !== id));
        } else {
            console.error('Error deleting area operacional:', error);
        }
    };

    const addEscalaTemplate = async (template: Omit<EscalaTemplate, 'id' | 'created_at'>, items: Omit<EscalaTemplateItem, 'id' | 'created_at' | 'template_id'>[]) => {
        try {
            const { data: tData, error: tError } = await supabase.from('escala_templates').insert(template).select().single();
            if (tError) throw tError;

            if (items.length > 0) {
                const itemsToInsert = items.map(item => ({ ...item, template_id: tData.id }));
                const { error: iError } = await supabase.from('escala_template_items').insert(itemsToInsert);
                if (iError) throw iError;
            }

            await refreshData();
            return { success: true };
        } catch (error) {
            console.error('Error adding escala template:', error);
            return { success: false, error };
        }
    };

    const deleteEscalaTemplate = async (id: string) => {
        const { error } = await supabase.from('escala_templates').delete().eq('id', id);
        if (!error) {
            setEscalaTemplates(prev => prev.filter(t => t.id !== id));
        } else {
            console.error('Error deleting template:', error);
        }
    };

    const updateEscalaTemplate = async (id: string, name: string) => {
        const { error } = await supabase.from('escala_templates').update({ nome: name }).eq('id', id);
        if (!error) {
            setEscalaTemplates(prev => prev.map(t => t.id === id ? { ...t, nome: name } : t));
        } else {
            console.error('Error updating template:', error);
        }
    };

    const addTemplateItem = async (item: Omit<EscalaTemplateItem, 'id' | 'created_at'>) => {
        const { error } = await supabase.from('escala_template_items').insert(item);
        if (!error) {
            await refreshData();
        } else {
            console.error('Error adding template item:', error);
        }
    };

    const deleteTemplateItem = async (id: string) => {
        const { error } = await supabase.from('escala_template_items').delete().eq('id', id);
        if (!error) {
            setEscalaTemplateItems(prev => prev.filter(ti => ti.id !== id));
        } else {
            console.error('Error deleting template item:', error);
        }
    };

    return (
        <WorkshopContext.Provider value={{
            fornecedores,
            setFornecedores,
            viaturas,
            setViaturas,
            clientes,
            setClientes,
            requisicoes,
            setRequisicoes,
            centrosCustos,
            setCentrosCustos,
            evaTransports,
            setEvaTransports,
            motoristas,
            setMotoristas,
            supervisors,
            setSupervisors,
            gestores,
            setGestores,
            oficinaUsers,
            setOficinaUsers,
            notifications,
            servicos,
            setServicos,
            scaleBatches,
            zonasOperacionais,
            areasOperacionais,
            escalaTemplates,
            escalaTemplateItems,
            stockItems,
            setStockItems,
            stockMovements,
            setStockMovements,
            addStockItem,
            updateStockItem,
            deleteStockItem,
            workshopAssets,
            setWorkshopAssets,
            addWorkshopAsset,
            updateWorkshopAsset,
            deleteWorkshopAsset,
            assignWorkshopAsset,
            createStockMovement,
            refreshInventoryData,
            syncStockRequisitionsToInventory,
            locais,
            addServico,
            updateServico,
            deleteServico,
            addLocal,
            updateLocal,
            deleteLocal,
            checkRouteValidation,
            geofences,
            geofenceVisits,
            cartrackVehicles,
            cartrackDrivers,
            cartrackError,
            dbConnectionError,
            fuelTank,
            fuelTransactions,
            tankRefills,
            vehicleMetrics,
            recalculateFuelTank,
            updateFuelTransaction,
            updateFuelTank,
            registerRefuel,
            confirmRefuel,
            registerTankRefill,
            setPumpTotalizer,
            deleteFuelTransaction,
            deleteTankRefill,
            manualHours,
            addManualHourRecord,
            deleteManualHourRecord,
            addFornecedor,
            updateFornecedor,
            deleteFornecedor,
            addCliente,
            updateCliente,
            deleteCliente,
            addViatura,
            updateViatura,
            deleteViatura,
            addRequisicao,
            updateRequisicao,
            deleteRequisicao,
            toggleRequisicaoStatus,
            addCentroCusto,
            deleteCentroCusto,
            addEvaTransport,
            deleteEvaTransport,
            addMotorista,
            updateMotorista,
            deleteMotorista,
            addSupervisor,
            updateSupervisor,
            deleteSupervisor,
            addGestor,
            updateGestor,
            deleteGestor,
            addOficinaUser,
            updateOficinaUser,
            deleteOficinaUser,
            createAdminUser,
            deleteAdminUser,
            addAvaliacao,
            adminUsers,
            avaliacoes,
            syncRealTimeRentals,
            addZonaOperacional,
            updateZonaOperacional,
            deleteZonaOperacional,
            addAreaOperacional,
            updateAreaOperacional,
            deleteAreaOperacional,
            addEscalaTemplate,
            deleteEscalaTemplate,
            updateEscalaTemplate,
            addTemplateItem,
            deleteTemplateItem,

            geofenceMappings,
            updateGeofenceMapping,
            getVehicleOccupancyHistory,
            addNotification,
            updateNotification,
            refreshData,
            complianceStats,
            runComplianceCheck,
            runComplianceDemo, // Fixed duplicate
            updateVehicleLocation: async (registration: string, lat: number, lng: number) => {
                try {
                    // Update Supabase
                    const { error } = await supabase
                        .from('viaturas')
                        .update({
                            latitude: lat,
                            longitude: lng,
                            last_position_update: new Date().toISOString()
                        })
                        .eq('matricula', registration);

                    if (error) throw error;

                    // Optimistic update local state
                    setCartrackVehicles(prev => prev.map(v =>
                        v.registration === registration
                            ? { ...v, latitude: lat, longitude: lng, last_position_update: new Date().toISOString() }
                            : v
                    ));
                } catch (err) {
                    console.error('Error updating vehicle location:', err);
                }
            },
            createScaleBatch: async (
                batchData: { notes?: string; centroCustoId: string; referenceDate: string },
                services: Servico[]
            ): Promise<{ success: boolean; data?: any; error?: any }> => {

                try {
                    const storedUser = localStorage.getItem('currentUser');
                    const storedRole = localStorage.getItem('userRole');

                    let user = null;
                    if (storedUser) user = JSON.parse(storedUser);

                    const { data: batch, error: batchError } = await supabase
                        .from('scale_batches')
                        .insert({
                            created_by: user?.nome || 'Sistema',
                            created_by_role: storedRole || null,
                            centro_custo_id: batchData.centroCustoId,
                            reference_date: batchData.referenceDate,
                            notes: batchData.notes,
                            status: 'active'
                        })
                        .select()
                        .single();

                    if (batchError) {
                        return { success: false, error: batchError.message };
                    }

                    const servicesToInsert = services.map(s => {
                        const urgent = s.isUrgent ?? isServiceUrgent(s.data || batchData.referenceDate, s.hora);
                        const isCompleted = Boolean(s.concluido || s.destinationConfirmed || s.destinationArrivalTime);
                        const origemLocation = resolveLocationByName(s.origem, s.originLocationId);
                        const destinoLocation = resolveLocationByName(s.destino, s.destinationLocationId);

                        const serviceRow: any = {
                            id: s.id,
                            motorista_id: s.motoristaId,
                            passageiro: s.passageiro,
                            hora: s.hora,
                            origem: s.origem,
                            destino: s.destino,
                            voo: s.voo,
                            obs: s.obs,
                            tipo: s.tipo || 'outro',
                            concluido: isCompleted,
                            centro_custo_id: batchData.centroCustoId,
                            batch_id: batch.id,
                            departamento: s.departamento,
                            status: normalizeStatusForDb(deriveServiceLifecycleStatus({
                                motoristaId: s.motoristaId,
                                serviceDate: s.data || batchData.referenceDate,
                                serviceHour: s.hora,
                                originConfirmed: Boolean(s.originConfirmed || s.originArrivalTime),
                                originDepartureTime: s.originDepartureTime,
                                destinationConfirmed: Boolean(s.destinationConfirmed || s.destinationArrivalTime)
                            }))
                        };

                        if (supportsServiceGeofencingColumnsRef.current) {
                            serviceRow.origem_location_id = origemLocation?.id || null;
                            serviceRow.destino_location_id = destinoLocation?.id || null;
                            serviceRow.origin_arrival_time = s.originArrivalTime || null;
                            serviceRow.destination_arrival_time = s.destinationArrivalTime || null;
                            serviceRow.origin_confirmed = Boolean(s.originConfirmed);
                            serviceRow.destination_confirmed = Boolean(s.destinationConfirmed);
                            serviceRow.origin_departure_time = s.originDepartureTime || null;
                            serviceRow.destination_departure_time = s.destinationDepartureTime || null;
                        }

                        if (supportsServiceAutoDispatchColumnsRef.current) {
                            serviceRow.vehicle_id = s.vehicleId || null;
                            serviceRow.passenger_count = Number(s.passengerCount || 1);
                            serviceRow.occupancy_rate = s.occupancyRate ?? null;
                        }

                        if (supportsUrgentColumnRef.current) {
                            serviceRow.is_urgent = urgent;
                        }

                        return serviceRow;
                    });

                    let { error: servicesError } = await supabase
                        .from('servicos')
                        .insert(servicesToInsert);

                    if (servicesError && supportsUrgentColumnRef.current && isMissingUrgentColumnError(servicesError)) {
                        supportsUrgentColumnRef.current = false;
                        const fallbackInsertRows = servicesToInsert.map(row => {
                            const { is_urgent, ...rest } = row;
                            return rest;
                        });

                        ({ error: servicesError } = await supabase
                            .from('servicos')
                            .insert(fallbackInsertRows));
                    }

                    if (servicesError && supportsServiceGeofencingColumnsRef.current && isMissingServiceGeofencingColumnError(servicesError)) {
                        supportsServiceGeofencingColumnsRef.current = false;
                        const fallbackInsertRows = servicesToInsert.map(row => stripGeofencingColumnsFromPayload(row));

                        ({ error: servicesError } = await supabase
                            .from('servicos')
                            .insert(fallbackInsertRows));
                    }

                    if (servicesError && supportsServiceAutoDispatchColumnsRef.current && isMissingServiceAutoDispatchColumnError(servicesError)) {
                        supportsServiceAutoDispatchColumnsRef.current = false;
                        const fallbackInsertRows = servicesToInsert.map(row => stripAutoDispatchColumnsFromPayload(row));

                        ({ error: servicesError } = await supabase
                            .from('servicos')
                            .insert(fallbackInsertRows));
                    }

                    if (servicesError) {
                        return { success: false, error: servicesError.message };
                    }

                    setScaleBatches(prev => [...prev, batch]);

                    const urgentCreatedServices = servicesToInsert.filter(s => s.is_urgent || s.status === 'URGENTE');
                    if (urgentCreatedServices.length > 0) {
                        const centro = centrosCustos.find(c => c.id === batchData.centroCustoId);

                        await addNotification({
                            id: crypto.randomUUID(),
                            type: 'system_alert',
                            data: {
                                title: '⚠ Serviço URGENTE criado',
                                message: `${urgentCreatedServices.length} serviço(s) urgente(s) para ${centro?.nome || 'Centro Operacional'}.`,
                                priority: 'high'
                            },
                            status: 'pending',
                            timestamp: new Date().toISOString()
                        });

                        await Promise.all(
                            urgentCreatedServices
                                .filter(s => !!s.motorista_id)
                                .map(s => addNotification({
                                    id: crypto.randomUUID(),
                                    type: 'transport_assignment',
                                    data: {
                                        serviceId: s.id,
                                        passenger: s.passageiro,
                                        origin: s.origem,
                                        destination: s.destino,
                                        time: s.hora,
                                        title: '⚠ Serviço URGENTE atribuído',
                                        message: `${s.passageiro} • ${s.hora} • ${s.origem} → ${s.destino}`,
                                        priority: 'high'
                                    },
                                    status: 'pending',
                                    response: { driverId: s.motorista_id as string, serviceId: s.id },
                                    timestamp: new Date().toISOString()
                                }))
                        );
                    }

                    return { success: true, data: batch };

                } catch (error: any) {
                    return { success: false, error: error?.message || 'Erro desconhecido' };
                }
            },

            cancelScaleBatch: async (batchId: string) => {
                try {
                    const { error } = await supabase
                        .from('scale_batches')
                        .update({ status: 'cancelled' })
                        .eq('id', batchId);

                    if (error) throw error;

                    setScaleBatches(prev => prev.map(b =>
                        b.id === batchId ? { ...b, status: 'cancelled' } : b
                    ));

                    return { success: true };
                } catch (error: any) {
                    console.error('Error cancelling batch:', error);
                    return { success: false, error: error.message };
                }
            },
            publishBatch: async (batchId: string) => {
                try {
                    const storedUser = localStorage.getItem('currentUser');
                    let userName = 'Sistema';
                    if (storedUser) {
                        try { userName = JSON.parse(storedUser)?.nome || 'Sistema'; } catch {}
                    }
                    const publishedAt = new Date().toISOString();

                    const { error } = await supabase
                        .from('scale_batches')
                        .update({
                            is_published: true,
                            published_at: publishedAt,
                            published_by: userName
                        })
                        .eq('id', batchId);

                    if (error) {
                        console.warn('publishBatch: column may not exist yet, falling back to local state', error);
                    }

                    setScaleBatches(prev => prev.map(b =>
                        b.id === batchId
                            ? { ...b, is_published: true, published_at: publishedAt, published_by: userName }
                            : b
                    ));

                    return { success: true };
                } catch (error: any) {
                    console.error('Error publishing batch:', error);
                    return { success: false, error: error.message };
                }
            },
            rotasPlaneadas,
            saveRoute,
            updateRouteStatus,
            logsOperacionais,
            registerLog
        }}>
            {children}
        </WorkshopContext.Provider >
    );
}

export function useWorkshop() {
    const context = useContext(WorkshopContext);
    if (context === undefined) {
        throw new Error('useWorkshop must be used within a WorkshopProvider');
    }
    return context;
}
