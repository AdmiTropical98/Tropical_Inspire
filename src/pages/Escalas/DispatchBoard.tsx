import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Car, Clock3, MapPin, Users, CheckCircle } from 'lucide-react';
import type { Motorista, Servico } from '../../types';
import { coerceServiceStatus, toDispatchStageLabel, updateServiceStatus } from '../../services/serviceStatus';

interface DispatchBoardProps {
    motoristas: Motorista[];
    pendentes: Servico[];
    assigned: Servico[];
    onMoveService: (service: Servico, targetDriverId: string | null) => Promise<void>;
    isUrgentService: (service: Partial<Servico>) => boolean;
}

type ServiceVisualState = 'scheduled' | 'active' | 'completed' | 'delayed' | 'urgent';

const sortByTime = (services: Servico[]) => [...services].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

const getServiceState = (service: Servico, isUrgentService: (service: Partial<Servico>) => boolean): ServiceVisualState => {
    if (isUrgentService(service)) return 'urgent';
    const canonical = coerceServiceStatus(service.status) || updateServiceStatus(service);
    if (canonical === 'COMPLETED') return 'completed';
    if (canonical === 'EN_ROUTE_ORIGIN' || canonical === 'ARRIVED_ORIGIN' || canonical === 'BOARDING' || canonical === 'EN_ROUTE_DESTINATION') return 'active';
    if (canonical === 'DRIVER_ASSIGNED' || canonical === 'SCHEDULED') return 'scheduled';
    return 'scheduled';
};

const stateStyles: Record<ServiceVisualState, { label: string; badge: string; border: string; accent: string }> = {
    scheduled: {
        label: 'Scheduled',
        badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
        border: 'border-slate-600/50',
        accent: 'bg-slate-400/70'
    },
    active: {
        label: 'Active',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        border: 'border-amber-500/40',
        accent: 'bg-amber-400'
    },
    completed: {
        label: 'Completed',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        border: 'border-emerald-500/40',
        accent: 'bg-emerald-400'
    },
    delayed: {
        label: 'Delayed',
        badge: 'bg-red-500/20 text-red-300 border-red-500/40',
        border: 'border-red-500/50',
        accent: 'bg-red-400'
    },
    urgent: {
        label: 'Urgent',
        badge: 'bg-red-500/20 text-red-300 border-red-500/40',
        border: 'border-red-500/50',
        accent: 'bg-red-400'
    }
};

function ServiceCard({ service, isUrgentService }: { service: Servico; isUrgentService: (service: Partial<Servico>) => boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `service:${service.id}` });
    const status = coerceServiceStatus(service.status) || updateServiceStatus(service);
    const state = getServiceState(service, isUrgentService);
    const styles = stateStyles[state];
    const stageLabel = toDispatchStageLabel(status);
    const passengerCount = Number(service.passengerCount || 1);

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1
    } as const;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`rounded-2xl border ${styles.border} bg-slate-800/75 p-3 shadow-md shadow-black/20 cursor-grab active:cursor-grabbing backdrop-blur-sm`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-200 font-bold">
                    <Clock3 className="w-3.5 h-3.5 text-blue-300" />
                    <span className="font-mono text-blue-300">{service.hora}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>{stageLabel}</span>
            </div>

            <div className="space-y-1.5">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate" title={service.origem}>{service.origem}</span>
                    </div>
                    {service.originConfirmed && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-400 mt-0.5 ml-5" title="Chegada à Origem Confirmada (Geofence)">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>{service.originArrivalTime ? new Date(service.originArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate" title={service.destino}>{service.destino}</span>
                    </div>
                    {service.destinationConfirmed && (
                        <div className="flex items-center gap-1 text-[9px] text-emerald-400 mt-0.5 ml-5" title="Chegada ao Destino Confirmada (Geofence)">
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>{service.destinationArrivalTime ? new Date(service.destinationArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmado'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{passengerCount} passageiro{passengerCount > 1 ? 's' : ''}</span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${styles.accent}`} />
                    Status
                </span>
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
    debugInfo
}: {
    id: string;
    title: string;
    subtitle?: string;
    vehicle?: string;
    count: number;
    services: Servico[];
    isUrgentService: (service: Partial<Servico>) => boolean;
    debugInfo?: string;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const isPendingColumn = id === 'pending';

    return (
        <section
            ref={setNodeRef}
            className={`w-[300px] shrink-0 rounded-2xl border bg-[#0f172a] ${isOver ? 'border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,.35)]' : 'border-white/10'} flex flex-col min-h-0`}
        >
            <header className="p-3 border-b border-white/10 bg-slate-900/70 rounded-t-2xl">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            {isPendingColumn ? <Clock3 className="w-4 h-4 text-amber-300" /> : <Car className="w-4 h-4 text-indigo-300" />}
                            {title}
                        </h3>
                        {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
                        {!isPendingColumn && (
                            <p className="text-[11px] text-indigo-300/90 truncate inline-flex items-center gap-1 mt-0.5">
                                <Car className="w-3 h-3" />
                                {vehicle || 'Sem viatura associada'}
                            </p>
                        )}
                        {debugInfo && (
                            <p className="text-[9px] text-slate-500 mt-1 truncate max-w-full opacity-50 font-mono">
                                DBG: {debugInfo}
                            </p>
                        )}
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-200">{count} serviço{count === 1 ? '' : 's'}</span>
                </div>
            </header>

            <div className="p-2.5 space-y-2 overflow-y-auto custom-scrollbar min-h-[160px] h-[calc(100vh-320px)]">
                {services.length === 0 ? (
                    <div className="h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500 bg-slate-900/30">
                        Largar serviço aqui
                    </div>
                ) : (
                    services.map(service => (
                        <ServiceCard key={service.id} service={service} isUrgentService={isUrgentService} />
                    ))
                )}
            </div>
        </section>
    );
}

export default function DispatchBoard({ motoristas, pendentes, assigned, onMoveService, isUrgentService }: DispatchBoardProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const servicesByDriver = new Map<string, Servico[]>();
    motoristas.forEach(driver => {
        servicesByDriver.set(driver.id, sortByTime(assigned.filter(s => s.motoristaId === driver.id)));
    });

    const resolveTargetColumn = (overId: string, allServices: Servico[]): string | null => {
        if (overId === 'pending' || overId.startsWith('driver:')) return overId;
        if (overId.startsWith('service:')) {
            const serviceId = overId.replace('service:', '');
            const targetService = allServices.find(s => s.id === serviceId);
            if (!targetService) return null;
            return targetService.motoristaId ? `driver:${targetService.motoristaId}` : 'pending';
        }
        return null;
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const activeId = String(event.active.id || '');
        const overId = String(event.over?.id || '');
        if (!activeId.startsWith('service:') || !overId) return;

        const serviceId = activeId.replace('service:', '');
        const allServices = [...pendentes, ...assigned];
        const service = allServices.find(s => s.id === serviceId);
        if (!service) return;

        const targetColumn = resolveTargetColumn(overId, allServices);
        if (!targetColumn) return;

        const targetDriverId = targetColumn === 'pending' ? null : targetColumn.replace('driver:', '');
        const currentDriverId = service.motoristaId || null;

        if (currentDriverId === targetDriverId) return;
        await onMoveService(service, targetDriverId);
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="mb-2 px-1 flex items-center gap-2 text-xs text-slate-400">
                <Clock3 className="w-4 h-4" />
                Dispatch Board • Arrastar entre Pendentes e Motoristas
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar min-h-0">
                    <div className="flex gap-3 h-full min-w-max pb-1">
                        <BoardColumn
                            id="pending"
                            title="Pendentes"
                            subtitle="Sem motorista atribuído"
                            count={pendentes.length}
                            services={sortByTime(pendentes)}
                            isUrgentService={isUrgentService}
                        />

                        {motoristas.map(driver => {
                            const driverServices = servicesByDriver.get(driver.id) || [];
                            return (
                                <BoardColumn
                                    key={driver.id}
                                    id={`driver:${driver.id}`}
                                    title={driver.nome}
                                    subtitle={driver.status ? `Estado: ${driver.status}` : undefined}
                                    vehicle={driver.currentVehicle || undefined}
                                    count={driverServices.length}
                                    services={driverServices}
                                    isUrgentService={isUrgentService}
                                    debugInfo={(driver as any).debugInfo}
                                />
                            );
                        })}
                    </div>
                </div>
            </DndContext>
        </div>
    );
}
