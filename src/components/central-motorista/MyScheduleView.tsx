import { Calendar, Info, CheckCircle, Clock, User, Users, ArrowLeft, LogIn, LogOut, CheckSquare, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { type Servico } from '../../types';

interface MyScheduleViewProps {
    services: Servico[];
    onBack?: () => void;
    complianceStats?: Record<string, { status: 'success' | 'failed' | 'pending'; message?: string }>;
    onUpdateStatus?: (service: Servico) => Promise<void>;
}

export default function MyScheduleView({ services, onBack, complianceStats, onUpdateStatus }: MyScheduleViewProps) {


    // Group services by date
    const groupedServices = services.reduce((groups, service) => {
        let dateKey = 'Data Inválida';
        let rawDate = 0;

        try {
            // Handle cases where 'hora' is full ISO, or we need to combine data+hora
            let dateObj = new Date(service.hora);

            // If invalid date (e.g. just HH:mm), try to use today's date + time
            if (isNaN(dateObj.getTime())) {
                const today = new Date();
                const [hours, minutes] = service.hora.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    dateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
                }
            }

            // Sort Key (Time)
            rawDate = dateObj.getTime();

            // Display Key (Day)
            dateKey = dateObj.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
            // Uppercase first letter
            dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);

        } catch (e) {
            console.error('Date parsing error', e);
        }

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push({ ...service, _parsedDate: rawDate });
        return groups;
    }, {} as Record<string, (Servico & { _parsedDate: number })[]>);

    // Sort dates chronological
    const sortedGroupKeys = Object.keys(groupedServices).sort((a, b) => {
        const timeA = groupedServices[a][0]._parsedDate;
        const timeB = groupedServices[b][0]._parsedDate;
        return timeA - timeB;
    });

    // State for Failure Modal
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [failureModalOpen, setFailureModalOpen] = useState(false);
    const [failureReason, setFailureReason] = useState('');

    const handleSuccess = (service: Servico) => {
        if (window.confirm('Confirma que recolheu o passageiro?')) {
            onUpdateStatus?.({ ...service, status: 'completed', concluido: true }); // Using 'completed' for 'Pegou' based on analysis
        }
    };

    const handleFailure = (serviceId: string) => {
        setSelectedServiceId(serviceId);
        setFailureModalOpen(true);
        setFailureReason('');
    };

    const submitFailure = () => {
        if (!selectedServiceId || !onUpdateStatus) return;
        const service = services.find(s => s.id === selectedServiceId);
        if (service) {
            onUpdateStatus({ ...service, status: 'failed', failureReason: failureReason || 'Não especificado', concluido: true }); // Failed is also "Finalized" in terms of schedule
        }
        setFailureModalOpen(false);
        setSelectedServiceId(null);
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0 relative">
            {/* Modal for Failure Reason */}
            {failureModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-full">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Passageiro Não Recolhido</h3>
                        </div>
                        <p className="text-slate-400 mb-4 text-sm">Por favor, indique o motivo da falha na recolha:</p>

                        <div className="space-y-2 mb-6">
                            {['Não compareceu à paragem', 'Folga / Não necessita', 'Erro na escala / Cancelado', 'Viatura Avariada', 'Outros'].map(reason => (
                                <button
                                    key={reason}
                                    onClick={() => setFailureReason(reason)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all font-medium text-sm
                                        ${failureReason === reason
                                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/20'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'}`}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setFailureModalOpen(false)}
                                className="flex-1 py-3 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitFailure}
                                disabled={!failureReason}
                                className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Header with Back Button */}
            <div className="md:hidden flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-50 border-b border-slate-700/50 -mx-4 px-4 shadow-lg">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 hover:bg-slate-700/50 rounded-full transition-colors text-slate-300"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-white leading-tight">Minha Escala</h2>
                    <p className="text-xs text-slate-400">Serviços Atribuídos</p>
                </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        Minha Escala
                    </h2>
                    <p className="text-slate-400 text-sm">Consulta os teus serviços agendados</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:block">Status:</span>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded text-xs text-emerald-400 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Concluídos
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded text-xs text-amber-400 border border-amber-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Agendados
                        </div>
                    </div>
                </div>
            </div>

            {services.length === 0 ? (
                <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50 border-dashed mt-8 md:mt-0">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Sem serviços agendados</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">
                        Não tens serviços atribuídos para os próximos dias.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 md:space-y-8">
                    {sortedGroupKeys.map(date => (
                        <div key={date} className="space-y-3 md:space-y-4">
                            {/* Date Header - Sticky on Desktop, Inline on Mobile */}
                            <div className="flex items-center gap-3 py-2 px-2 md:sticky md:top-0 md:bg-[#0f172a]/95 md:backdrop-blur md:z-10">
                                <span className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent"></span>
                                <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-wider px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full whitespace-nowrap">
                                    {date}
                                </h3>
                                <span className="h-px flex-1 bg-gradient-to-l from-blue-500/50 to-transparent"></span>
                            </div>

                            {/* Desktop Table View (Hidden on Mobile) */}
                            <div className="hidden md:block">
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-900/50 border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                                                <th className="px-6 py-4 font-bold">Horário</th>
                                                <th className="px-6 py-4 font-bold">Passageiro</th>
                                                <th className="px-6 py-4 font-bold">Itinerário</th>
                                                <th className="px-6 py-4 font-bold w-1/4">Observações</th>
                                                <th className="px-6 py-4 font-bold text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {groupedServices[date].map((service) => (
                                                <tr key={service.id} className="hover:bg-slate-800/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-slate-700 p-2 rounded text-white font-mono font-bold">
                                                                {new Date(service._parsedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                                    <User className="w-4 h-4" />
                                                                </div>
                                                                <span className="text-white font-medium">{service.passageiro || 'Não definido'}</span>
                                                            </div>
                                                            {/* COMPLIANCE DESKTOP */}
                                                            {complianceStats?.[service.id] && (
                                                                <div className={`flex items-center gap-1 text-[10px] font-bold ${complianceStats[service.id].status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {complianceStats[service.id].status === 'success' ? <CheckSquare className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                                    <span>{complianceStats[service.id].message}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                <span className="text-slate-300">{service.origem}</span>
                                                            </div>
                                                            <div className="ml-0.5 border-l border-slate-700 h-3"></div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                                <span className="text-white font-medium">{service.destino}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {service.obs ? (
                                                            <div className="flex items-start gap-2">
                                                                <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                                                <p className="text-sm text-slate-400 italic line-clamp-2">{service.obs}</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 text-sm">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {service.concluido ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${service.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                                {service.status === 'failed' ? (
                                                                    <>
                                                                        <AlertTriangle className="w-3.5 h-3.5" /> Falhou: {service.failureReason}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle className="w-3.5 h-3.5" /> Concluído
                                                                    </>
                                                                )}
                                                            </span>
                                                        ) : (
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleFailure(service.id)}
                                                                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                                        title="Não Pegou"
                                                                    >
                                                                        <User className="w-5 h-5 text-red-500/50 hover:text-red-500" />
                                                                        <span className="sr-only">Não Pegou</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSuccess(service)}
                                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle className="w-4 h-4" />
                                                                        Pegou
                                                                    </button>
                                                                </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Card View (Enhanced & Explanatory) */}
                            <div className="md:hidden grid gap-4">
                                {Object.values(groupedServices[date].reduce((acc, service) => {
                                    // Secondary Grouping: Time + Origin + Destination
                                    const key = `${service.hora}-${service.origem}-${service.destino}`;
                                    if (!acc[key]) {
                                        acc[key] = {
                                            ...service,
                                            passengers: [service.passageiro || 'Sem Nome'],
                                            ids: [service.id],
                                            isGroup: false
                                        };
                                    } else {
                                        acc[key].passengers.push(service.passageiro || 'Sem Nome');
                                        acc[key].ids.push(service.id);
                                        acc[key].isGroup = true;
                                        // If any in group is NOT concluded, group is NOT concluded (pessimistic)
                                        // or if ALL are concluded, group is concluded. Let's say if ANY is pending, group is pending.
                                        if (!service.concluido) acc[key].concluido = false;
                                    }
                                    return acc;
                                }, {} as Record<string, any>)).map((service: any) => {
                                    // Determine Compliance Status for the Group/Card
                                    // If it's a group, we check if ANY failed -> Failed. Else if ALL success -> Success.
                                    let groupComplianceStatus: 'success' | 'failed' | 'pending' | null = null;
                                    let groupComplianceMsg = '';

                                    if (complianceStats) {
                                        const statuses = service.ids.map((id: string) => complianceStats[id]);
                                        if (statuses.some((s: any) => s?.status === 'failed')) {
                                            groupComplianceStatus = 'failed';
                                            groupComplianceMsg = statuses.find((s: any) => s?.status === 'failed')?.message || 'Falha na validação';
                                        } else if (statuses.every((s: any) => s?.status === 'success')) {
                                            groupComplianceStatus = 'success';
                                            groupComplianceMsg = statuses[0]?.message || 'Validado';
                                        }
                                    }

                                    const stripColor = groupComplianceStatus === 'success'
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                                        : groupComplianceStatus === 'failed'
                                            ? 'bg-gradient-to-r from-red-600 to-rose-500'
                                            : service.concluido
                                                ? (service.status === 'failed' ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-blue-500 to-indigo-400')
                                                : 'bg-gradient-to-r from-amber-500 to-orange-400';

                                    return (
                                        <div
                                            key={service.isGroup ? service.ids.join('-') : service.id}
                                            className={`bg-slate-800 rounded-2xl border ${groupComplianceStatus === 'failed' ? 'border-red-500/50' : 'border-slate-700'} shadow-xl overflow-hidden transition-all`}
                                        >
                                            {/* Status Header Strip */}
                                            <div className={`h-1.5 w-full ${stripColor}`}></div>

                                            <div className="p-4 space-y-4">
                                                {/* Time & Status Row */}
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3 w-full">
                                                        <div className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700 shadow-inner flex flex-col items-center min-w-[70px]">
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hora</span>
                                                            <span className="text-xl font-black text-white tracking-tight">
                                                                {new Date(service._parsedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col w-full">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Estado do Serviço</span>
                                                            <div className="flex justify-between items-center w-full pr-2">
                                                                {service.concluido ? (
                                                                    <div className={`flex items-center gap-1.5 ${service.status === 'failed' ? 'text-red-400' : 'text-blue-400'} font-bold text-sm`}>
                                                                        {service.status === 'failed' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                                        <span>{service.status === 'failed' ? 'Falhou' : 'Concluído'}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                                                                        <Clock className="w-4 h-4" />
                                                                        <span>Agendado</span>
                                                                    </div>
                                                                )}

                                                                {/* COMPLIANCE BADGE MOBILE */}
                                                                {groupComplianceStatus && (
                                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                                                                    ${groupComplianceStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}
                                                                `}>
                                                                        {groupComplianceStatus === 'success' ? <CheckSquare className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                                        <span className="truncate max-w-[100px]">{groupComplianceMsg}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Passenger Row (Single or Multiple) */}
                                                <div className="bg-slate-700/30 rounded-xl p-3 flex flex-col gap-2 border border-slate-700/50">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                                            {service.isGroup ? <Users className="w-3 h-3 text-blue-400" /> : <User className="w-3 h-3 text-blue-400" />}
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                            {service.isGroup ? `Passageiros (${service.passengers.length})` : 'Passageiro'}
                                                        </span>
                                                    </div>

                                                    {service.isGroup ? (
                                                        <div className="pl-8 grid gap-1">
                                                            {service.passengers.map((p: string, idx: number) => (
                                                                <div key={idx} className="flex items-center gap-2 text-white font-medium text-sm border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                                    {p}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="pl-8">
                                                            <span className="text-white font-bold text-base truncate block">{service.passageiro || 'Nome não indicado'}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Route Timeline */}
                                                <div className="relative pl-2 py-1">
                                                    {/* Connecting Line */}
                                                    <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-purple-600 opacity-30"></div>

                                                    <div className="space-y-6">
                                                        {/* Origin */}
                                                        <div className="relative flex gap-3">
                                                            <div className="w-5 h-5 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center shrink-0 z-10 bg-slate-800">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block mb-0.5">De (Origem)</span>
                                                                <p className="text-slate-200 font-medium leading-tight text-sm">{service.origem}</p>
                                                            </div>
                                                        </div>

                                                        {/* Destination */}
                                                        <div className="relative flex gap-3">
                                                            <div className="w-5 h-5 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center shrink-0 z-10 bg-slate-800">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mb-0.5">Para (Destino)</span>
                                                                <p className="text-white font-bold leading-tight text-sm">{service.destino}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ACTION BUTTONS (Mobile) - NEW */}
                                                {!service.concluido && !service.isGroup && (
                                                    <div className="grid grid-cols-2 gap-3 mt-2 border-t border-slate-700/50 pt-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleFailure(service.id); }}
                                                            className="flex items-center justify-center gap-2 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 rounded-xl font-bold text-xs transition-colors"
                                                        >
                                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                                            Não Pegou
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSuccess(service); }}
                                                            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-900/20"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                            Pegou
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Footer / Obs */}
                                                {service.obs && (
                                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                        {(() => {
                                                            const txt = service.obs.toLowerCase();
                                                            const isEntrada = txt.includes('entrada');
                                                            const isSaida = txt.includes('saída') || txt.includes('saida');

                                                            if (isEntrada) {
                                                                return (
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 border border-emerald-500/20 shrink-0">
                                                                            <LogIn className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider block">Entrada</span>
                                                                            {service.obs.length > 10 && <p className="text-slate-400 text-xs mt-0.5">{service.obs}</p>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            if (isSaida) {
                                                                return (
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="bg-rose-500/10 p-2 rounded-lg text-rose-400 border border-rose-500/20 shrink-0">
                                                                            <LogOut className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-rose-400 text-xs font-bold uppercase tracking-wider block">Saída</span>
                                                                            {service.obs.length > 10 && <p className="text-slate-400 text-xs mt-0.5">{service.obs}</p>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div className="flex gap-2 text-slate-400">
                                                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                                                    <div className="text-xs">
                                                                        <span className="font-bold text-slate-500 mr-1 uppercase text-[10px] tracking-wider">Obs:</span>
                                                                        {service.obs}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
