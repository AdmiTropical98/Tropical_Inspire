import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Fornecedor, Requisicao, Viatura, Motorista, Supervisor, Gestor, Notification, OficinaUser, FuelTank, FuelTransaction, TankRefillLog, CentroCusto, EvaTransport, Cliente, AdminUser, Servico, Avaliacao, ManualHourRecord, Local } from '../types';
import { CartrackService, cleanTagId, getTagVariants, type CartrackGeofence, type CartrackGeofenceVisit } from '../services/cartrack';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

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
    geofences: CartrackGeofence[];
    geofenceVisits: CartrackGeofenceVisit[]; // NEW
    cartrackVehicles: import('../services/cartrack').CartrackVehicle[];
    cartrackDrivers: import('../services/cartrack').CartrackDriver[];
    cartrackError: string | null;

    // POI / Locais
    locais: Local[];
    addLocal: (l: Local) => Promise<void>;
    updateLocal: (l: Local) => Promise<void>;
    deleteLocal: (id: string) => Promise<void>;
    checkRouteValidation: (serviceId: string) => Promise<Record<string, { status: 'success' | 'failed'; time?: string; distance?: number }>>;
    // Fuel
    fuelTank: FuelTank;
    fuelTransactions: FuelTransaction[];
    tankRefills: TankRefillLog[];
    updateFuelTank: (tank: FuelTank) => void;
    registerRefuel: (transaction: FuelTransaction) => void;
    confirmRefuel: (transactionId: string) => Promise<{ error?: any } | void>;
    registerTankRefill: (log: TankRefillLog) => void;
    setPumpTotalizer: (val: number) => void;
    deleteFuelTransaction: (id: string) => void;
    deleteTankRefill: (id: string) => void;

    // Manual Hours
    manualHours: import('../types').ManualHourRecord[];
    addManualHourRecord: (record: import('../types').ManualHourRecord) => Promise<void>;
    deleteManualHourRecord: (id: string) => Promise<void>;

    addFornecedor: (f: Fornecedor) => void;
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
    toggleRequisicaoStatus: (id: string, fatura?: string, custo?: number) => void;
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
    addGestor: (g: Gestor) => void;
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
    createScaleBatch: (batchData: { notes?: string, centroCustoId: string, referenceDate: string }, services: Servico[]) => Promise<{ success: boolean; error?: string }>;
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




    const [evaTransports, setEvaTransports] = useState<EvaTransport[]>([]);



    const [motoristas, setMotoristas] = useState<Motorista[]>([]);





    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [oficinaUsers, setOficinaUsers] = useState<OficinaUser[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);



    // LocalStorage sync removed as we are now using Supabase
    // Cross-tab sync should be handled by Supabase Realtime in the future

    // NEW: Services State (Lifted)
    const [servicos, setServicos] = useState<any[]>([]);



    // COMPLIANCE LOGIC
    const [complianceStats, setComplianceStats] = useState<Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }>>({});

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
                const visits = await CartrackService.getGeofenceVisits(startOfDay, endOfDay, vehicleId);

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

    const refreshData = async () => {
        try {
            setCartrackError(null);
            // 1. Core Data
            const { data: f } = await supabase.from('fornecedores').select('*');
            if (f) setFornecedores(f);

            const { data: c } = await supabase.from('clientes').select('*');
            if (c) setClientes(c);

            // POIs
            const { data: loc } = await supabase.from('locais').select('*');
            if (loc) setLocais(loc.map((l: any) => ({ ...l, userId: l.user_id })));

            const { data: v } = await supabase.from('viaturas').select('*');
            if (v) setViaturas(v.map((item: any) => ({ ...item, precoDiario: item.preco_diario })));

            const { data: cc } = await supabase.from('centros_custos').select('*');
            if (cc) setCentrosCustos(cc.map((item: any) => ({ ...item, id: item.id, nome: item.nome, localizacao: item.localizacao, codigo: item.codigo })));

            const { data: r } = await supabase.from('requisicoes').select('*');
            if (r) setRequisicoes(r.map((item: any) => ({ ...item, itens: item.itens || [], numero: String(item.numero), fornecedorId: item.fornecedor_id, viaturaId: item.viatura_id, centroCustoId: item.centro_custo_id, criadoPor: item.criado_por, custo: item.custo })));

            const { data: av } = await supabase.from('avaliacoes').select('*');
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
            const { data: dbMotoristas } = await supabase.from('motoristas').select('*');

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
                    status: m.status || 'disponivel'
                }));

                // Attempt Cartrack Enrichment (Safe Mode)
                try {
                    const [driversResult, vehiclesResult] = await Promise.allSettled([
                        CartrackService.getDrivers(),
                        CartrackService.getVehicles()
                    ]);

                    if (driversResult.status === 'fulfilled') cDrivers = driversResult.value;
                    else console.warn('Cartrack Drivers fetch failed:', driversResult.reason);

                    if (vehiclesResult.status === 'fulfilled') cVehicles = vehiclesResult.value;
                    else {
                        console.warn('Cartrack Vehicles fetch failed:', vehiclesResult.reason);
                        setCartrackError(`Falha na Cartrack: ${vehiclesResult.reason?.message || 'Erro de conexão'}`);
                    }

                    // If Cartrack succeeded, perform enrichment
                    if (cDrivers && cVehicles) {
                        const enriched = await Promise.all(dbMotoristas.map(async (m: any) => {
                            // 1. Try to find missing cartrackId by matching cartrackKey
                            let currentCartrackId = m.cartrack_id;
                            if (!currentCartrackId && m.cartrack_key) {
                                const matchedCDriver = cDrivers.find(cd => cd.tagId === m.cartrack_key);
                                if (matchedCDriver) {
                                    currentCartrackId = matchedCDriver.id;
                                    // Silent update to persist relation
                                    await supabase.from('motoristas').update({ cartrack_id: matchedCDriver.id }).eq('id', m.id);
                                }
                            }

                            // 2. Active Vehicle Status
                            const activeVehicle = cVehicles.find(v =>
                                (currentCartrackId && String(v.driverId) === String(currentCartrackId)) ||
                                (v.driverName && v.driverName.toLowerCase() === m.nome.toLowerCase()) ||
                                (m.current_vehicle && normalizePlate(v.registration) === normalizePlate(m.current_vehicle))
                            );

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
                    // This prevents "João Lisboa" (or any last known driver) from sticking to parked cars
                    const shouldShowCartrackDriver = v.status !== 'stopped' || !!v.tagId;

                    if (localM) {
                        displayName = localM.nome;
                    } else if (shouldShowCartrackDriver && isProperName(resolvedName)) {
                        displayName = resolvedName!;
                    }

                    return {
                        ...v,
                        driverName: displayName
                    };

                    if (v.registration.includes('ZZ')) {
                        console.log('Debug ZZ:', {
                            reg: v.registration,
                            driverId: v.driverId,
                            resolvedName,
                            localFound: !!localM,
                            displayName
                        });
                    }

                    return {
                        ...v,
                        driverName: displayName
                    };
                });

                setMotoristas(updatedMotoristas);
                setCartrackVehicles(enrichedVehicles);

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

            const { data: sups } = await supabase.from('supervisores').select('*');
            if (sups) setSupervisors(sups.map((s: any) => ({ ...s, password: s.password, blockedPermissions: s.blocked_permissions, dataRegisto: s.data_registo })));

            const { data: managers } = await supabase.from('gestores').select('*');
            if (managers) setGestores(managers.map((g: any) => ({ ...g, blockedPermissions: g.blocked_permissions, dataRegisto: g.data_registo })));

            const { data: oficina } = await supabase.from('oficina_users').select('*');
            if (oficina) setOficinaUsers(oficina.map((u: any) => ({ ...u, blockedPermissions: u.blocked_permissions, dataRegisto: u.data_registo })));

            // 4. Notifications & Services
            const { data: notifs } = await supabase.from('notifications').select('*');
            if (notifs) setNotifications(notifs.map((n: any) => ({ ...n, data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data, response: typeof n.response === 'string' ? JSON.parse(n.response) : n.response })));

            const { data: servs, error: servError } = await supabase.from('servicos').select('*');
            if (servError) console.error('Error fetching services:', servError);
            if (servs) {
                console.log('Fetched services:', servs.length);
                setServicos(servs.map((s: any) => ({ ...s, motoristaId: s.motorista_id, centroCustoId: s.centro_custo_id })));
            }

            // 5. Fuel
            const { data: tankData } = await supabase.from('fuel_tank').select('*').eq('id', 'main').single();
            if (tankData) setFuelTank({ id: tankData.id, capacity: tankData.capacity, currentLevel: tankData.current_level, pumpTotalizer: tankData.pump_totalizer, lastRefillDate: tankData.last_refill_date, averagePrice: tankData.average_price });

            const { data: transData } = await supabase.from('fuel_transactions').select('*');
            if (transData) setFuelTransactions(transData.map((t: any) => ({ ...t, driverId: t.driver_id, vehicleId: t.vehicle_id, staffId: t.staff_id, staffName: t.staff_name, pumpCounterAfter: t.pump_counter_after, pricePerLiter: t.price_per_liter, totalCost: t.total_cost, centroCustoId: t.centro_custo_id })));

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

            // 6. Locais (POIs)
            const { data: locs } = await supabase.from('locais').select('*');
            if (locs) setLocais(locs.map((l: any) => ({
                id: l.id,
                nome: l.nome,
                latitude: l.latitude,
                longitude: l.longitude,
                raio: l.raio,
                tipo: l.tipo,
                cor: l.cor
            })));

        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };

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
            const { data, error } = await supabase.from('servicos').insert({
                id: s.id,
                motorista_id: s.motoristaId,
                passageiro: s.passageiro,
                hora: s.hora,
                origem: s.origem,
                destino: s.destino,
                voo: s.voo,
                obs: s.obs,
                concluido: s.concluido,
                centro_custo_id: s.centroCustoId
            }).select().single();

            if (error) throw error;
            console.log('Service added successfully:', data);

            // Update local state with the CONFIRMED data from DB to ensure sync
            // We map back from DB columns (snake_case) to app types (camelCase) if needed, 
            // but for simplicity here we assume 's' is correct if DB write succeeded.
            // Better: use 'data' to reconstruct.
            const confirmedService: Servico = {
                ...s,
                motoristaId: data.motorista_id,
                centroCustoId: data.centro_custo_id
            };

            await logServiceHistory(s.id, 'CREATE', null, confirmedService);

            setServicos(prev => [...prev, confirmedService]);
        } catch (error: any) {
            console.error('Error adding service:', error);
            alert(`Erro ao adicionar serviço: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const updateServico = async (s: Servico) => {
        try {
            console.log('Updating service:', s.id, s);
            const { data, error } = await supabase.from('servicos').update({
                motorista_id: s.motoristaId,
                passageiro: s.passageiro,
                hora: s.hora,
                origem: s.origem,
                destino: s.destino,
                voo: s.voo,
                obs: s.obs,
                concluido: s.concluido,
                centro_custo_id: s.centroCustoId
            }).eq('id', s.id).select();

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
            await logServiceHistory(s.id, 'UPDATE', previousState, s);

            console.log('Service updated:', data);
            setServicos(prev => prev.map(item => item.id === s.id ? s : item));
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
            user_id: l.userId
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
            cor: l.cor
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

    useEffect(() => {
        refreshData();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
            if (event === 'SIGNED_IN') {
                refreshData();
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // Fuel Methods
    const updateFuelTank = async (tank: FuelTank) => {
        const { error } = await supabase.from('fuel_tank').upsert({
            id: 'main',
            capacity: tank.capacity,
            current_level: tank.currentLevel,
            pump_totalizer: tank.pumpTotalizer,
            last_refill_date: tank.lastRefillDate,
            average_price: tank.averagePrice
        });
        if (!error) setFuelTank(tank);
    };

    const registerRefuel = async (transaction: FuelTransaction) => {
        const currentPMP = fuelTank.averagePrice || 0;
        const totalCost = transaction.liters * currentPMP;

        let finalStatus = transaction.status || 'pending';
        let pumpCounterAfter = 0;

        // If explicitly confirmed (Dual Auth), calculate tank updates immediately
        if (finalStatus === 'confirmed') {
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

        const transactionToSave = {
            ...transaction,
            status: finalStatus,
            pricePerLiter: currentPMP,
            totalCost: totalCost,
            pumpCounterAfter: finalStatus === 'confirmed' ? pumpCounterAfter : undefined
        };

        const { error } = await supabase.from('fuel_transactions').insert({
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
            pump_counter_after: transactionToSave.pumpCounterAfter
        });

        if (!error) {
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
            await updateFuelTank({
                ...fuelTank,
                currentLevel: newLevel,
                pumpTotalizer: newTotalizer,
                lastRefillDate: log.timestamp,
                averagePrice: newAveragePrice
            });
            setTankRefills(prev => [log, ...prev]);
        }
    };

    const setPumpTotalizer = async (val: number) => {
        await updateFuelTank({ ...fuelTank, pumpTotalizer: val });
    };

    const deleteFuelTransaction = async (id: string) => {
        const trans = fuelTransactions.find(t => t.id === id);
        if (trans) {
            const { error } = await supabase.from('fuel_transactions').delete().eq('id', id);
            if (!error) {
                // If the transaction was confirmed, revert the tank changes
                if (trans.status === 'confirmed') {
                    const currentTotalizer = fuelTank.pumpTotalizer || 0;
                    const reversedTotalizer = Math.max(0, currentTotalizer - trans.liters);
                    const reversedLevel = Math.min(fuelTank.capacity, fuelTank.currentLevel + trans.liters);

                    await updateFuelTank({
                        ...fuelTank,
                        currentLevel: reversedLevel,
                        pumpTotalizer: reversedTotalizer
                    });
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
                // Revert tank level (Fuel In -> Revert by removing liters)
                const reversedLevel = Math.max(0, fuelTank.currentLevel - refill.litersAdded);

                await updateFuelTank({
                    ...fuelTank,
                    currentLevel: reversedLevel
                    // We do not revert PMP or Totalizer here as it's complex/ambiguous for Supplies
                });

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
            preco_diario: v.precoDiario
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
            preco_diario: v.precoDiario
        }).eq('id', v.id);
        if (!error) setViaturas(prev => prev.map(curr => curr.id === v.id ? v : curr));
    };
    const deleteViatura = async (id: string) => {
        const { error } = await supabase.from('viaturas').delete().eq('id', id);
        if (!error) setViaturas(prev => prev.filter(v => v.id !== id));
    };

    const addRequisicao = async (r: Requisicao) => {
        const { error } = await supabase.from('requisicoes').insert({
            id: r.id,
            numero: r.numero,
            data: r.data,
            tipo: r.tipo,
            fornecedor_id: r.fornecedorId,
            viatura_id: r.viaturaId,
            centro_custo_id: r.centroCustoId,
            obs: r.obs || '',
            status: r.status || 'pendente',
            criado_por: r.criadoPor,
            itens: r.itens
        });
        if (error) {
            console.error('Error adding requisition:', error);
            return;
        }
        setRequisicoes(prev => [{ ...r, status: r.status || 'pendente' }, ...prev]);
    };
    const updateRequisicao = async (r: Requisicao) => {
        const { error } = await supabase.from('requisicoes').update({
            data: r.data,
            tipo: r.tipo,
            fornecedor_id: r.fornecedorId,
            viatura_id: r.viaturaId,
            centro_custo_id: r.centroCustoId,
            obs: r.obs || '',
            status: r.status,
            criado_por: r.criadoPor
        }).eq('id', r.id);
        if (!error) setRequisicoes(prev => prev.map(curr => curr.id === r.id ? r : curr));
    };
    const deleteRequisicao = async (id: string) => {
        const { error } = await supabase.from('requisicoes').delete().eq('id', id);
        if (!error) setRequisicoes(prev => prev.filter(r => r.id !== id));
    };

    const toggleRequisicaoStatus = async (id: string, fatura?: string, custo?: number) => {
        const r = requisicoes.find(req => req.id === id);
        if (r) {
            const newStatus = r.status === 'concluida' ? 'pendente' : 'concluida';
            const updates: any = { status: newStatus };
            if (newStatus === 'concluida') {
                if (fatura) updates.fatura = fatura;
                if (custo) updates.custo = custo;
            }

            const { error } = await supabase.from('requisicoes').update(updates).eq('id', id);
            if (!error) {
                setRequisicoes(prev => prev.map(req => {
                    if (req.id === id) {
                        return {
                            ...req,
                            status: newStatus,
                            fatura: (newStatus === 'concluida' && fatura) ? fatura : req.fatura,
                            custo: (newStatus === 'concluida' && custo) ? custo : req.custo
                        };
                    }
                    return req;
                }));
            }
        }
    };

    // Motoristas and others remain local for now as per plan focus
    const addMotorista = async (m: Motorista) => {
        const { error } = await supabase.from('motoristas').insert({
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
            centro_custo_id: m.centroCustoId
        });
        if (!error) setMotoristas(prev => [...prev, m]);
    };
    const updateMotorista = async (m: Motorista) => {
        const { error } = await supabase.from('motoristas').update({
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
            centro_custo_id: m.centroCustoId
        }).eq('id', m.id);

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
        if (!error) setSupervisors(prev => [...prev, s]);
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
            blocked_permissions: g.blockedPermissions
        });
        if (!error) setGestores(prev => [...prev, g]);
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
            addServico,
            updateServico,
            deleteServico,
            locais,
            addLocal,
            updateLocal,
            deleteLocal,
            checkRouteValidation,
            geofences,
            geofenceVisits,
            cartrackVehicles,
            cartrackDrivers,
            cartrackError,
            fuelTank,
            fuelTransactions,
            tankRefills,
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
            createScaleBatch: async (batchData: { notes?: string, centroCustoId: string, referenceDate: string }, services: Servico[]) => {
                try {
                    const storedUser = localStorage.getItem('currentUser');
                    let user = null;
                    if (storedUser) user = JSON.parse(storedUser);

                    // 1. Create Batch
                    const { data: batch, error: batchError } = await supabase.from('scale_batches').insert({
                        created_by: user?.nome || 'Sistema',
                        centro_custo_id: batchData.centroCustoId,
                        reference_date: batchData.referenceDate,
                        notes: batchData.notes
                    }).select().single();

                    if (batchError) throw batchError;

                    // 2. Prepare Services with batch_id
                    const servicesToInsert = services.map(s => ({
                        id: s.id,
                        motorista_id: s.motoristaId, // Should be null usually
                        passageiro: s.passageiro,
                        hora: s.hora,
                        origem: s.origem,
                        destino: s.destino,
                        voo: s.voo,
                        obs: s.obs, // "Ida" or "Volta" usually
                        tipo: s.tipo || 'outro',
                        concluido: false,
                        centro_custo_id: batchData.centroCustoId,
                        batch_id: batch.id
                    }));

                    const { error: servicesError } = await supabase.from('servicos').insert(servicesToInsert);

                    if (servicesError) {
                        // Rollback batch? Supabase doesn't support easy rollback from client unless RPC. 
                        // For now we assume success or manual cleanup if needed.
                        throw servicesError;
                    }

                    // 3. Log History for each (Optional but good for consistency)
                    // We can do this async to not block UI
                    services.forEach(s => {
                        const confirmed = { ...s, batchId: batch.id, centroCustoId: batchData.centroCustoId };
                        logServiceHistory(s.id, 'CREATE', null, confirmed);
                    });

                    // 4. Update Local State
                    // Convert back to app format
                    const newServices = servicesToInsert.map(s => ({
                        id: s.id,
                        motoristaId: s.motorista_id,
                        passageiro: s.passageiro,
                        hora: s.hora,
                        origem: s.origem,
                        destino: s.destino,
                        voo: s.voo,
                        obs: s.obs,
                        tipo: s.tipo,
                        concluido: s.concluido,
                        centroCustoId: s.centro_custo_id,
                        batchId: s.batch_id
                    }));

                    setServicos(prev => [...prev, ...newServices]);

                    return { success: true, data: batch };

                } catch (error: any) {
                    console.error('Error creating batch:', error);
                    return { success: false, error: error.message };
                }
            }
        }}>
            {children}
        </WorkshopContext.Provider>
    );
}

export function useWorkshop() {
    const context = useContext(WorkshopContext);
    if (context === undefined) {
        throw new Error('useWorkshop must be used within a WorkshopProvider');
    }
    return context;
}
