import { useMemo, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragCancelEvent,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Car, CheckCircle, Clock3, MapPin, RefreshCw, Sparkles, Users, Wand2 } from 'lucide-react';
import type { Motorista, Servico } from '../../types';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { coerceServiceStatus, toDispatchStageLabel, updateServiceStatus } from '../../services/serviceStatus';

interface DispatchBoardProps {
    motoristas: Motorista[];
    pendentes: Servico[];
    assigned: Servico[];
    onMoveService: (service: Servico, targetDriverId: string | null) => Promise<void>;
    isUrgentService: (service: Partial<Servico>) => boolean;
}

type ServiceVisualState = 'scheduled' | 'active' | 'completed' | 'delayed' | 'urgent';
type WorkloadLevel = 'low' | 'medium' | 'high';

interface DriverSuggestion {
    driverId: string;
    score: number;
}

interface ConflictResult {
    hasConflict: boolean;
    message?: string;
}

const sortByTime = (services: Servico[]) => [...services].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

const toMinutes = (value?: string) => {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const getServiceState = (service: Servico, isUrgentService: (service: Partial<Servico>) => boolean): ServiceVisualState => {
    if (isUrgentService(service)) return 'urgent';
    const canonical = coerceServiceStatus(service.status) || updateServiceStatus(service);
    if (canonical === 'COMPLETED') return 'completed';
    if (canonical === 'EN_ROUTE_ORIGIN' || canonical === 'ARRIVED_ORIGIN' || canonical === 'BOARDING' || canonical === 'EN_ROUTE_DESTINATION') return 'active';
    if (canonical === 'DRIVER_ASSIGNED' || canonical === 'SCHEDULED') return 'scheduled';
    return 'scheduled';
};

const stateStyles: Record<ServiceVisualState, { badge: string; accent: string }> = {
    scheduled: { badge: 'bg-slate-100 text-slate-700 border-slate-200', accent: 'bg-slate-400/80' },
    active: { badge: 'bg-amber-100 text-amber-700 border-amber-200', accent: 'bg-amber-500' },
    completed: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', accent: 'bg-emerald-500' },
    delayed: { badge: 'bg-red-100 text-red-700 border-red-200', accent: 'bg-red-500' },
    urgent: { badge: 'bg-red-100 text-red-700 border-red-200', accent: 'bg-red-500' }
};

const getDriverStateBadge = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ocupado' || normalized === 'em_servico') {
        return { label: 'EM ROTA', dotClass: 'bg-emerald-400', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    }
    if (normalized === 'indisponivel' || normalized === 'offline') {
        return { label: 'OFFLINE', dotClass: 'bg-slate-500', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    if (normalized === 'standby') {
        return { label: 'STANDBY', dotClass: 'bg-amber-400', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: 'DISPONIVEL', dotClass: 'bg-blue-400', className: 'bg-blue-100 text-blue-700 border-blue-200' };
};

const getWorkloadLevel = (count: number): { level: WorkloadLevel; label: string; className: string } => {
    if (count >= 5) return { level: 'high', label: 'Carga Alta', className: 'bg-red-100 text-red-700 border-red-200' };
    if (count >= 3) return { level: 'medium', label: 'Carga Media', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { level: 'low', label: 'Carga Baixa', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};

const getWorkloadPercent = (count: number) => {
    if (count <= 0) return 8;
    return Math.min(100, Math.round((count / 6) * 100));
};

const getVehicleBadge = (driver?: Motorista) => {
    if (!driver?.currentVehicle) {
        return { label: 'Sem viatura', className: 'bg-red-100 text-red-700 border-red-200' };
    }

    const operationalState = String(driver.estadoOperacional || '').toLowerCase();
    if (operationalState === 'em_oficina') {
        return { label: 'Viatura oficina', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }

    if (operationalState === 'indisponivel') {
        return { label: 'Viatura offline', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }

    return { label: `Viatura ${driver.currentVehicle}`, className: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
};

const isDriverAvailable = (driver?: Motorista) => {
    const status = String(driver?.status || '').toLowerCase();
    return status !== 'indisponivel' && status !== 'ferias' && status !== 'offline';
};

const getDriverConflict = (driver: Motorista | undefined, service: Servico, allAssigned: Servico[]): ConflictResult => {
    if (!driver) return { hasConflict: true, message: 'Motorista não encontrado.' };
    if (!driver.currentVehicle) return { hasConflict: true, message: 'Motorista sem viatura atribuída.' };
    if (!isDriverAvailable(driver)) return { hasConflict: true, message: 'Motorista indisponível.' };

    const serviceMinutes = toMinutes(service.hora);
    const sameDriverServices = allAssigned.filter(s => s.motoristaId === driver.id && s.id !== service.id);

    const exactConflict = sameDriverServices.find(s => String(s.hora || '') === String(service.hora || ''));
    if (exactConflict) return { hasConflict: true, message: `Conflito: já existe serviço às ${service.hora}.` };

    if (serviceMinutes !== null) {
        const overlap = sameDriverServices.find(existing => {
            const existingMinutes = toMinutes(existing.hora);
            if (existingMinutes === null) return false;
            return Math.abs(existingMinutes - serviceMinutes) < 45;
        });

        if (overlap) {
            return { hasConflict: true, message: `Sobreposição detectada com serviço próximo (${overlap.hora}).` };
        }
    }

    return { hasConflict: false };
};

function ServiceCard({
    service,
    isUrgentService,
    drivers,
    suggestedDriverId,
    onAssign,
    onSelect,
    isSelected,
    keyboardDriverIds,
    assigned
}: {
    service: Servico;
    isUrgentService: (service: Partial<Servico>) => boolean;
    drivers: Motorista[];
    suggestedDriverId: string | null;
    onAssign: (service: Servico, targetDriverId: string | null, source: 'drag' | 'button' | 'keyboard' | 'auto') => Promise<void>;
    onSelect: (serviceId: string) => void;
    isSelected: boolean;
    keyboardDriverIds: string[];
    assigned: Servico[];
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `service:${service.id}` });
    const status = coerceServiceStatus(service.status) || updateServiceStatus(service);
    const state = getServiceState(service, isUrgentService);
    const styles = stateStyles[state];
    const stageLabel = toDispatchStageLabel(status);
    const passengerCount = Number(service.passengerCount || 1);

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.82 : 1
    } as const;

    const handleKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(service.id);
            return;
        }

        if (event.key.toLowerCase() === 'a') {
            event.preventDefault();
            if (suggestedDriverId) await onAssign(service, suggestedDriverId, 'keyboard');
            return;
        }

        const parsed = Number(event.key);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 9) {
            const targetDriverId = keyboardDriverIds[parsed - 1];
            if (!targetDriverId) return;
            event.preventDefault();
            await onAssign(service, targetDriverId, 'keyboard');
        }
    };

    const suggestedDriverName = suggestedDriverId ? drivers.find(driver => driver.id === suggestedDriverId)?.nome : null;
    const assignedDriver = service.motoristaId ? drivers.find(driver => driver.id === service.motoristaId) : undefined;
    const hasConflict = Boolean(service.motoristaId && getDriverConflict(assignedDriver, service, assigned).hasConflict);
    const serviceCardClass = !service.motoristaId ? 'pending' : hasConflict ? 'conflict' : 'scheduled';

    return (
        <div
            ref={setNodeRef}
            style={style}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={() => onSelect(service.id)}
            {...listeners}
            {...attributes}
            className={`service-card ${serviceCardClass} rounded-2xl border border-slate-200 bg-white p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500/35 shadow-blue-100' : 'hover:shadow-md'} ${isDragging ? 'scale-[1.01]' : 'scale-100'}`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                    <Clock3 className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-mono text-blue-700">{service.hora}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>{stageLabel}</span>
            </div>

            {suggestedDriverName && !service.motoristaId && (
                <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                    <Sparkles className="w-3 h-3" />
                    Suggested driver: {suggestedDriverName}
                </div>
            )}

            <div className="space-y-1.5">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate" title={service.origem}>{service.origem}</span>
                    </div>
                    {service.originConfirmed && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-500 mt-0.5 ml-5" title="Chegada à Origem Confirmada (Geofence)">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>{service.originArrivalTime ? new Date(service.originArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate" title={service.destino}>{service.destino}</span>
                    </div>
                    {service.destinationConfirmed && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-500 mt-0.5 ml-5" title="Chegada ao Destino Confirmada (Geofence)">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>{service.destinationArrivalTime ? new Date(service.destinationArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{passengerCount} passageiro{passengerCount > 1 ? 's' : ''}</span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${styles.accent}`} />
                    Status
                </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (!suggestedDriverId) return;
                        onAssign(service, suggestedDriverId, 'button');
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${suggestedDriverId ? 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100' : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'}`}
                    disabled={!suggestedDriverId}
                >
                    <Wand2 className="h-3 w-3" />
                    Atribuir sugestão
                </button>

                <select
                    value=""
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                        const value = event.target.value;
                        if (!value) return;
                        void onAssign(service, value, 'button');
                        event.target.value = '';
                    }}
                    className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 focus:border-blue-400 focus:outline-none"
                >
                    <option value="">Assign to driver</option>
                    {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>{driver.nome}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function BoardColumn({
    id,
    title,
    subtitle,
    vehicle,
    count,
    services,
    isUrgentService,
    debugInfo,
    driver,
    activeDragService,
    isDropAllowed,
    highlighted,
    drivers,
    suggestedDriverByService,
    onAssign,
    selectedServiceId,
    onSelect,
    keyboardDriverIds,
    assigned
}: {
    id: string;
    title: string;
    subtitle?: string;
    vehicle?: string;
    count: number;
    services: Servico[];
    isUrgentService: (service: Partial<Servico>) => boolean;
    debugInfo?: string;
    driver?: Motorista;
    activeDragService: Servico | null;
    isDropAllowed: boolean;
    highlighted: boolean;
    drivers: Motorista[];
    suggestedDriverByService: Map<string, string>;
    onAssign: (service: Servico, targetDriverId: string | null, source: 'drag' | 'button' | 'keyboard' | 'auto') => Promise<void>;
    selectedServiceId: string | null;
    onSelect: (serviceId: string) => void;
    keyboardDriverIds: string[];
    assigned: Servico[];
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const isPendingColumn = id === 'pending';
    const driverBadge = getDriverStateBadge(driver?.status);
    const vehicleBadge = getVehicleBadge(driver);
    const workload = getWorkloadLevel(count);
    const workloadPercent = getWorkloadPercent(count);
    const canPreviewDrop = Boolean(activeDragService && isOver && isDropAllowed);

    return (
        <section
            ref={setNodeRef}
            className={`dispatch-column w-[300px] shrink-0 rounded-2xl border bg-white flex flex-col min-h-0 transition-all duration-200 ${
                isOver && isDropAllowed
                    ? 'border-blue-300 shadow-[0_0_0_1px_rgba(59,130,246,.25)]'
                    : isOver && !isDropAllowed
                        ? 'border-red-300 shadow-[0_0_0_1px_rgba(239,68,68,.2)]'
                        : 'border-slate-200'
            } ${highlighted ? 'ring-2 ring-emerald-300/60' : ''} ${isPendingColumn ? 'pending-column' : ''}`}
        >
            <header className="p-3 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        {!isPendingColumn && (
                            <span className={`status-badge inline-flex items-center gap-2 border ${driverBadge.className}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${driverBadge.dotClass}`} />
                                {driverBadge.label}
                            </span>
                        )}
                        <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5 mt-1">
                            {isPendingColumn ? <Clock3 className="w-4 h-4 text-red-500" /> : <Car className="w-4 h-4 text-indigo-500" />}
                            {title}
                        </h3>
                        {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
                        {!isPendingColumn && <p className="text-[11px] text-indigo-600 truncate inline-flex items-center gap-1 mt-0.5"><Car className="w-3 h-3" />{vehicle || 'Sem viatura associada'}</p>}
                        {debugInfo && <p className="text-[9px] text-slate-400 mt-1 truncate max-w-full font-mono">DBG: {debugInfo}</p>}
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">{count} serviço{count === 1 ? '' : 's'}</span>
                </div>

                {!isPendingColumn && (
                    <div className="mt-2 space-y-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${vehicleBadge.className}`}>{vehicleBadge.label}</span>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                <span>Carga operacional</span>
                                <span className={`px-1.5 py-0.5 rounded border ${workload.className}`}>{workload.label}</span>
                            </div>
                            <div className="h-[6px] rounded-[6px] bg-slate-200 overflow-hidden">
                                <div className="load-bar" style={{ width: `${workloadPercent}%` }} />
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <div className={`drop-zone p-2.5 space-y-2 overflow-y-auto custom-scrollbar min-h-[160px] h-[calc(100vh-320px)] transition-colors duration-200 bg-[#f8fafc] ${isOver && isDropAllowed ? 'drag-over' : ''}`}>
                {canPreviewDrop && activeDragService && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                        <p className="font-semibold">Pré-visualização de drop</p>
                        <p className="truncate">{activeDragService.hora} • {activeDragService.origem}</p>
                    </div>
                )}

                {services.map(service => (
                    <ServiceCard
                        key={service.id}
                        service={service}
                        isUrgentService={isUrgentService}
                        drivers={drivers}
                        suggestedDriverId={suggestedDriverByService.get(service.id) || null}
                        onAssign={onAssign}
                        onSelect={onSelect}
                        isSelected={selectedServiceId === service.id}
                        keyboardDriverIds={keyboardDriverIds}
                        assigned={assigned}
                    />
                ))}

                {services.length === 0 && (
                    <div className={`drop-zone w-full h-24 flex flex-col items-center justify-center gap-1 text-xs transition-all ${
                        isOver && isDropAllowed
                            ? 'drag-over text-blue-700'
                            : 'text-slate-500 bg-white'
                    }`}>
                        <span className="text-[11px] font-semibold">Drag service here or click to assign</span>
                        <span className="text-[10px] text-slate-400">Atribuição rápida disponível</span>
                    </div>
                )}
            </div>
        </section>
    );
}

export default function DispatchBoard({ motoristas, pendentes, assigned, onMoveService, isUrgentService }: DispatchBoardProps) {
    const { refreshData, isRefreshing } = useWorkshop();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [activeDragServiceId, setActiveDragServiceId] = useState<string | null>(null);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [autoDistributeEnabled, setAutoDistributeEnabled] = useState(false);
    const [recentlyUpdatedColumns, setRecentlyUpdatedColumns] = useState<string[]>([]);

    const servicesByDriver = useMemo(() => {
        const map = new Map<string, Servico[]>();
        motoristas.forEach(driver => {
            map.set(driver.id, sortByTime(assigned.filter(s => s.motoristaId === driver.id)));
        });
        return map;
    }, [motoristas, assigned]);

    const withVehicle = useMemo(() => motoristas.filter(driver => Boolean(driver.currentVehicle)), [motoristas]);
    const withoutVehicle = useMemo(() => motoristas.filter(driver => !driver.currentVehicle), [motoristas]);
    const inRoute = useMemo(() => withVehicle.filter(driver => {
        const status = String(driver.status || '').toLowerCase();
        return status === 'ocupado' || status === 'em_servico';
    }), [withVehicle]);
    const available = useMemo(() => withVehicle.filter(driver => !inRoute.includes(driver)), [withVehicle, inRoute]);

    const workshopDrivers = useMemo(() => withVehicle.filter(driver => String(driver.estadoOperacional || '').toLowerCase() === 'em_oficina'), [withVehicle]);
    const activeDrivers = useMemo(() => withVehicle.filter(driver => !workshopDrivers.includes(driver)), [withVehicle, workshopDrivers]);

    const sections = useMemo(() => [
        { key: 'active', label: 'Motoristas Ativos', drivers: activeDrivers },
        { key: 'unassigned', label: 'Sem Viatura', drivers: withoutVehicle },
        { key: 'workshop', label: 'Oficina', drivers: workshopDrivers }
    ], [activeDrivers, withoutVehicle, workshopDrivers]);

    const allServices = useMemo(() => [...pendentes, ...assigned], [pendentes, assigned]);
    const serviceById = useMemo(() => {
        const map = new Map<string, Servico>();
        allServices.forEach(service => map.set(service.id, service));
        return map;
    }, [allServices]);

    const availableForAssignment = useMemo(() => {
        return motoristas
            .filter(driver => isDriverAvailable(driver) && Boolean(driver.currentVehicle))
            .sort((a, b) => (servicesByDriver.get(a.id)?.length || 0) - (servicesByDriver.get(b.id)?.length || 0));
    }, [motoristas, servicesByDriver]);

    const scoreDriverSuggestion = (driver: Motorista, service: Servico): DriverSuggestion => {
        let score = 0;

        if (isDriverAvailable(driver)) score += 30;
        if (driver.currentVehicle) score += 20;
        if (String(driver.status || '').toLowerCase() === 'ocupado') score -= 8;
        if (String(driver.estadoOperacional || '').toLowerCase() === 'em_oficina') score -= 20;
        if (service.centroCustoId && driver.centroCustoId === service.centroCustoId) score += 12;

        const load = servicesByDriver.get(driver.id)?.length || 0;
        score -= load * 6;

        if (getDriverConflict(driver, service, assigned).hasConflict) score -= 200;
        return { driverId: driver.id, score };
    };

    const suggestedDriverByService = useMemo(() => {
        const map = new Map<string, string>();
        pendentes.forEach(service => {
            const scored = motoristas.map(driver => scoreDriverSuggestion(driver, service)).sort((a, b) => b.score - a.score);
            const best = scored[0];
            if (best && best.score > -100) map.set(service.id, best.driverId);
        });
        return map;
    }, [pendentes, motoristas, assigned, servicesByDriver]);

    const activeDragService = activeDragServiceId ? serviceById.get(activeDragServiceId) || null : null;

    const markColumnUpdated = (driverId: string | null) => {
        const key = driverId ? `driver:${driverId}` : 'pending';
        setRecentlyUpdatedColumns(prev => {
            const next = Array.from(new Set([...prev, key]));
            window.setTimeout(() => {
                setRecentlyUpdatedColumns(current => current.filter(item => item !== key));
            }, 800);
            return next;
        });
    };

    const assignServiceWithGuards = async (
        service: Servico,
        targetDriverId: string | null,
        source: 'drag' | 'button' | 'keyboard' | 'auto'
    ) => {
        const currentDriverId = service.motoristaId || null;
        if (currentDriverId === targetDriverId) return;

        if (targetDriverId) {
            const driver = motoristas.find(item => item.id === targetDriverId);
            const conflict = getDriverConflict(driver, service, assigned);
            if (conflict.hasConflict) {
                if (source === 'auto') return;
                const proceed = window.confirm(`${conflict.message}\n\nDeseja atribuir mesmo assim?`);
                if (!proceed) return;
            }
        }

        await onMoveService(service, targetDriverId);
        markColumnUpdated(currentDriverId);
        markColumnUpdated(targetDriverId);
    };

    const distributePendingServices = async () => {
        const queue = sortByTime(pendentes);
        if (!queue.length || !availableForAssignment.length) return;

        const virtualLoad = new Map<string, number>();
        availableForAssignment.forEach(driver => {
            virtualLoad.set(driver.id, servicesByDriver.get(driver.id)?.length || 0);
        });

        for (const service of queue) {
            const ordered = [...availableForAssignment].sort((a, b) => (virtualLoad.get(a.id) || 0) - (virtualLoad.get(b.id) || 0));
            const candidate = ordered.find(driver => !getDriverConflict(driver, service, assigned).hasConflict);
            if (!candidate) continue;
            await assignServiceWithGuards(service, candidate.id, 'auto');
            virtualLoad.set(candidate.id, (virtualLoad.get(candidate.id) || 0) + 1);
        }
    };

    const resolveTargetColumn = (overId: string): string | null => {
        if (overId === 'pending' || overId.startsWith('driver:')) return overId;
        if (overId.startsWith('service:')) {
            const serviceId = overId.replace('service:', '');
            const targetService = allServices.find(s => s.id === serviceId);
            if (!targetService) return null;
            return targetService.motoristaId ? `driver:${targetService.motoristaId}` : 'pending';
        }
        return null;
    };

    const isDropAllowed = (columnId: string, service: Servico | null) => {
        if (!service) return true;
        if (columnId === 'pending') return true;
        if (!columnId.startsWith('driver:')) return false;

        const driverId = columnId.replace('driver:', '');
        const driver = motoristas.find(item => item.id === driverId);
        return !getDriverConflict(driver, service, assigned).hasConflict;
    };

    const handleDragStart = (event: DragStartEvent) => {
        const activeId = String(event.active.id || '');
        if (!activeId.startsWith('service:')) return;
        setActiveDragServiceId(activeId.replace('service:', ''));
    };

    const handleDragCancel = (_event: DragCancelEvent) => {
        setActiveDragServiceId(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const activeId = String(event.active.id || '');
        const overId = String(event.over?.id || '');
        setActiveDragServiceId(null);
        if (!activeId.startsWith('service:') || !overId) return;

        const serviceId = activeId.replace('service:', '');
        const service = allServices.find(s => s.id === serviceId);
        if (!service) return;

        const targetColumn = resolveTargetColumn(overId);
        if (!targetColumn) return;

        if (!isDropAllowed(targetColumn, service)) {
            window.alert('Atribuição bloqueada: conflito de agenda ou motorista sem viatura.');
            return;
        }

        const targetDriverId = targetColumn === 'pending' ? null : targetColumn.replace('driver:', '');
        await assignServiceWithGuards(service, targetDriverId, 'drag');
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="mb-2 px-1 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4" />
                    Dispatch Board • Arrastar, clicar ou teclado para atribuir
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAutoDistributeEnabled(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all ${autoDistributeEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                        title="Modo Auto distribute services"
                    >
                        <Wand2 className="w-3.5 h-3.5" />
                        Auto distribute services
                    </button>

                    <button
                        type="button"
                        onClick={() => distributePendingServices()}
                        disabled={!autoDistributeEnabled || pendentes.length === 0}
                        className={`px-3 py-1 rounded-lg border transition-all ${autoDistributeEnabled && pendentes.length > 0 ? 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        Distribuir agora
                    </button>

                    <button
                        onClick={() => refreshData()}
                        disabled={isRefreshing}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 transition-all ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Forçar sincronização com Cartrack e Base de Dados"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                </div>
            </div>

            {selectedServiceId && (
                <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                    Serviço selecionado para teclado. Atalhos: <span className="font-semibold">A</span> para sugestão, <span className="font-semibold">1..9</span> para motorista.
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar min-h-0">
                    <div className="flex gap-3 h-full min-w-max pb-1">
                        <BoardColumn
                            id="pending"
                            title="Pendentes"
                            subtitle="Sem motorista atribuído"
                            count={pendentes.length}
                            services={sortByTime(pendentes)}
                            isUrgentService={isUrgentService}
                            activeDragService={activeDragService}
                            isDropAllowed={isDropAllowed('pending', activeDragService)}
                            highlighted={recentlyUpdatedColumns.includes('pending')}
                            drivers={availableForAssignment}
                            suggestedDriverByService={suggestedDriverByService}
                            onAssign={assignServiceWithGuards}
                            selectedServiceId={selectedServiceId}
                            onSelect={setSelectedServiceId}
                            keyboardDriverIds={availableForAssignment.map(driver => driver.id)}
                            assigned={assigned}
                        />

                        {sections.map(section => (
                            <div key={section.key} className="space-y-1">
                                <div className="px-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {section.label}
                                    </span>
                                </div>

                                {section.drivers.length === 0 ? (
                                    <div className="dispatch-column w-[300px] shrink-0 rounded-2xl border border-slate-200 bg-white p-3 min-h-[220px]">
                                        <div className="drop-zone h-full flex flex-col items-center justify-center text-[11px] text-slate-500 bg-slate-50">
                                            <p className="font-semibold">Sem motoristas nesta secção</p>
                                            <p className="text-[10px] text-slate-400">Atualize estados/viaturas para preencher.</p>
                                        </div>
                                    </div>
                                ) : (
                                    section.drivers.map((driver) => {
                                        const driverServices = servicesByDriver.get(driver.id) || [];
                                        const columnId = `driver:${driver.id}`;

                                        return (
                                            <BoardColumn
                                                key={driver.id}
                                                id={columnId}
                                                title={driver.nome}
                                                subtitle={driver.status ? `Estado: ${driver.status}` : undefined}
                                                vehicle={driver.currentVehicle || undefined}
                                                count={driverServices.length}
                                                services={driverServices}
                                                isUrgentService={isUrgentService}
                                                debugInfo={(driver as any).debugInfo}
                                                driver={driver}
                                                activeDragService={activeDragService}
                                                isDropAllowed={isDropAllowed(columnId, activeDragService)}
                                                highlighted={recentlyUpdatedColumns.includes(columnId)}
                                                drivers={availableForAssignment}
                                                suggestedDriverByService={suggestedDriverByService}
                                                onAssign={assignServiceWithGuards}
                                                selectedServiceId={selectedServiceId}
                                                onSelect={setSelectedServiceId}
                                                keyboardDriverIds={availableForAssignment.map(item => item.id)}
                                                assigned={assigned}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                    {activeDragService ? (
                        <div className="w-[300px] rounded-2xl border border-blue-200 bg-white p-3 shadow-xl">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><Clock3 className="h-3.5 w-3.5" />{activeDragService.hora}</span>
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Drag Helper</span>
                            </div>
                            <div className="space-y-1 text-xs text-slate-700">
                                <p className="truncate"><span className="text-slate-500">Origem:</span> {activeDragService.origem}</p>
                                <p className="truncate"><span className="text-slate-500">Destino:</span> {activeDragService.destino}</p>
                                <p><span className="text-slate-500">Passageiros:</span> {Number(activeDragService.passengerCount || 1)}</p>
                                <p><span className="text-slate-500">Estado:</span> {toDispatchStageLabel(coerceServiceStatus(activeDragService.status) || updateServiceStatus(activeDragService))}</p>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <div className="mt-2 text-[11px] text-slate-500">
                Conflitos são validados antes da atribuição. Sugestões usam disponibilidade, centro de custo, carga e viatura.
            </div>
        </div>
    );
}
