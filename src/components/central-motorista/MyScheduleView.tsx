import { Calendar, Info, CheckCircle, Clock, User, ArrowLeft } from 'lucide-react';
import { type Servico } from '../../types';

interface MyScheduleViewProps {
    services: Servico[];
    onBack?: () => void;
}

export default function MyScheduleView({ services, onBack }: MyScheduleViewProps) {


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

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
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
                                                <th className="px-6 py-4 font-bold text-right">Estado</th>
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
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                                <User className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-white font-medium">{service.passageiro || 'Não definido'}</span>
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
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                                                                <CheckCircle className="w-3.5 h-3.5" /> Concluído
                                                            </span>
                                                        ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
                                                                <Clock className="w-3.5 h-3.5" /> Agendado
                                                            </span>
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
                                {groupedServices[date].map(service => (
                                    <div
                                        key={service.id}
                                        className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden"
                                    >
                                        {/* Status Header Strip */}
                                        <div className={`h-1.5 w-full ${service.concluido ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}></div>

                                        <div className="p-4 space-y-4">
                                            {/* Time & Status Row */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700 shadow-inner flex flex-col items-center min-w-[70px]">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hora</span>
                                                        <span className="text-xl font-black text-white tracking-tight">
                                                            {new Date(service._parsedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Estado do Serviço</span>
                                                        {service.concluido ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                                                                <CheckCircle className="w-4 h-4" />
                                                                <span>Concluído</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                                                                <Clock className="w-4 h-4" />
                                                                <span>Agendado</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Passenger Row */}
                                            <div className="bg-slate-700/30 rounded-xl p-3 flex items-center gap-3 border border-slate-700/50">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <User className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Passageiro</span>
                                                    <span className="text-white font-bold text-base truncate block">{service.passageiro || 'Nome não indicado'}</span>
                                                </div>
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

                                            {/* Footer / Obs */}
                                            {service.obs && (
                                                <div className="mt-2 pt-3 border-t border-slate-700/50">
                                                    <div className="flex gap-2 text-slate-400">
                                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                                        <div className="text-xs italic">
                                                            <span className="font-bold not-italic text-slate-500 mr-1">Obs:</span>
                                                            {service.obs}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
