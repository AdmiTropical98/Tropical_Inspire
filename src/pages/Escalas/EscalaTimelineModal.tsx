import React, { useMemo } from 'react';
import {
    X, Clock, MapPin, User, Car, CheckCircle,
    Circle, ArrowRight, Users, Calendar, Send
} from 'lucide-react';
import type { ScaleBatch, Servico, Motorista } from '../../types';

interface EscalaTimelineModalProps {
    batch: ScaleBatch;
    services: Servico[];
    motoristas: Motorista[];
    viaturas: any[];
    centrosCustos: any[];
    onClose: () => void;
}

interface TripGroup {
    motoristaId: string | null;
    motoristaNome: string;
    vehicleId: string | null;
    vehiclePlate: string;
    stops: Servico[];
}

function getStopStatus(service: Servico): 'completed' | 'active' | 'upcoming' {
    if (service.destinationConfirmed || service.concluido) return 'completed';
    if (service.originConfirmed || service.originArrivalTime) return 'active';
    return 'upcoming';
}

function formatHora(hora?: string) {
    if (!hora) return '--:--';
    return hora.substring(0, 5);
}

function formatDateTime(iso?: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function EscalaTimelineModal({
    batch,
    services,
    motoristas,
    viaturas,
    centrosCustos,
    onClose
}: EscalaTimelineModalProps) {
    const centroCusto = centrosCustos.find(c => c.id === batch.centro_custo_id);

    const tripGroups = useMemo<TripGroup[]>(() => {
        const sorted = [...services].sort((a, b) =>
            (a.hora || '').localeCompare(b.hora || '')
        );

        const groupMap = new Map<string, TripGroup>();

        sorted.forEach(service => {
            const motorista = motoristas.find(m => m.id === service.motoristaId);
            const viatura = viaturas.find(v => v.id === service.vehicleId);
            const resolvedVehiclePlate = viatura?.matricula || viatura?.plate || motorista?.currentVehicle || '—';
            const key = `${service.motoristaId || '__unassigned__'}:${service.vehicleId || resolvedVehiclePlate}`;

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    motoristaId: service.motoristaId || null,
                    motoristaNome: motorista?.nome || 'Sem Motorista',
                    vehicleId: service.vehicleId || null,
                    vehiclePlate: resolvedVehiclePlate,
                    stops: []
                });
            }
            groupMap.get(key)!.stops.push(service);
        });

        return Array.from(groupMap.values()).sort((a, b) => {
            if (a.motoristaId === null) return 1;
            if (b.motoristaId === null) return -1;
            return (a.stops[0]?.hora || '').localeCompare(b.stops[0]?.hora || '');
        });
    }, [services, motoristas, viaturas]);

    const completedCount = services.filter(s => s.destinationConfirmed || s.concluido).length;
    const activeCount = services.filter(s => (s.originConfirmed || s.originArrivalTime) && !(s.destinationConfirmed || s.concluido)).length;
    const upcomingCount = services.length - completedCount - activeCount;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-[#0f172a] border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-800/60 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Send className="w-3 h-3" /> PUBLICADA
                            </span>
                            {centroCusto && (
                                <span className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                    {centroCusto.nome}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-black text-white">Linha Cronológica da Escala</h2>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{batch.reference_date}</span>
                            <span className="flex items-center gap-1">
                                {batch.published_at && (
                                    <>publicado às {formatDateTime(batch.published_at)} por {batch.published_by}</>
                                )}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats */}
                <div className="px-6 py-3 border-b border-slate-800/40 grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/40 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-2xl font-black text-emerald-400">{completedCount}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Concluídos</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-2xl font-black text-amber-400">{activeCount}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Em Curso</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-2xl font-black text-slate-300">{upcomingCount}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Pendentes</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {tripGroups.map((group, gi) => (
                        <div key={gi}>
                            {/* Driver header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-900/20 shrink-0">
                                    {group.motoristaNome.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">{group.motoristaNome}</p>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                        {group.vehiclePlate !== '—' && (
                                            <span className="flex items-center gap-1">
                                                <Car className="w-3 h-3" />{group.vehiclePlate}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />{group.stops.length} paragem{group.stops.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Stops timeline */}
                            <div className="relative ml-4">
                                {group.stops.map((stop, si) => {
                                    const status = getStopStatus(stop);
                                    const isLast = si === group.stops.length - 1;

                                    return (
                                        <div key={stop.id} className="relative flex gap-4">
                                            {/* Vertical line */}
                                            {!isLast && (
                                                <div className="absolute left-[18px] top-8 bottom-0 w-px bg-slate-700/60" />
                                            )}

                                            {/* Dot */}
                                            <div className="shrink-0 mt-1.5">
                                                {status === 'completed' ? (
                                                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center">
                                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                    </div>
                                                ) : status === 'active' ? (
                                                    <div className="w-9 h-9 rounded-full bg-amber-500/15 border-2 border-amber-500/60 flex items-center justify-center animate-pulse">
                                                        <Circle className="w-4 h-4 text-amber-400 fill-amber-400/40" />
                                                    </div>
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-600/50 flex items-center justify-center">
                                                        <Circle className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className={`flex-1 mb-4 rounded-xl border p-3.5 transition-colors ${
                                                status === 'completed'
                                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                                    : status === 'active'
                                                    ? 'bg-amber-500/5 border-amber-500/30'
                                                    : 'bg-slate-800/40 border-slate-700/40'
                                            }`}>
                                                {/* Time + passenger */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg ${
                                                            status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                                                            status === 'active' ? 'bg-amber-500/20 text-amber-300' :
                                                            'bg-slate-700 text-slate-300'
                                                        }`}>
                                                            {formatHora(stop.hora)}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs text-slate-300 font-medium">
                                                            <User className="w-3 h-3 text-slate-500" />
                                                            {stop.passageiro}
                                                        </span>
                                                        {Number(stop.passengerCount || 1) > 1 && (
                                                            <span className="text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                                                                {stop.passengerCount} pax
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                                        status === 'active' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                                        'bg-slate-700/50 text-slate-500 border-slate-600/30'
                                                    }`}>
                                                        {status === 'completed' ? 'Concluído' : status === 'active' ? 'Em curso' : 'Pendente'}
                                                    </span>
                                                </div>

                                                {/* Route */}
                                                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                                    <div className="flex items-start gap-1.5">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs text-slate-200 leading-tight">{stop.origem}</p>
                                                            {stop.originArrivalTime && (
                                                                <p className="text-[10px] text-emerald-400 mt-0.5">
                                                                    Chegou {formatDateTime(stop.originArrivalTime)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                                                    <div className="flex items-start gap-1.5">
                                                        <MapPin className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs text-slate-200 leading-tight">{stop.destino}</p>
                                                            {stop.destinationArrivalTime && (
                                                                <p className="text-[10px] text-emerald-400 mt-0.5">
                                                                    Chegou {formatDateTime(stop.destinationArrivalTime)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Obs */}
                                                {stop.obs && (
                                                    <p className="mt-2 text-[10px] text-slate-500 italic border-t border-white/5 pt-2">
                                                        {stop.obs}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {services.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Clock className="w-12 h-12 mb-3 opacity-30" />
                            <p className="font-bold">Sem serviços nesta escala</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
