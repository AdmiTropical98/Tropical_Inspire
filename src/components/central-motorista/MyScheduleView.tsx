import { Calendar, Info, CheckCircle, Clock, User } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Servico } from '../../types';

interface MyScheduleViewProps {
    services: Servico[];
}

export default function MyScheduleView({ services }: MyScheduleViewProps) {
    const { t } = useTranslation();

    // Group services by date
    const groupedServices = services.reduce((groups, service) => {
        let dateKey = 'Data Inválida';
        let rawDate = 0;

        try {
            // Handle cases where 'hora' is full ISO, or we need to combine data+hora
            // Assuming service.hora is the main time field. If service.data exists, it might be the day.
            // For safety, let's try to parse 'hora' first.
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
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
                <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50 border-dashed">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Sem serviços agendados</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">
                        Não tens serviços atribuídos para os próximos dias.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                        {sortedGroupKeys.map(date => (
                        <div key={date} className="space-y-4">
                            {/* Date Header */}
                            <div className="flex items-center gap-3 sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur py-2">
                                <span className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent"></span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
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

                            {/* Mobile Card View (Visible on Mobile) */}
                            <div className="md:hidden grid gap-4">
                                {groupedServices[date].map(service => (
                                    <div
                                        key={service.id}
                                        className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 shadow-lg relative overflow-hidden"
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${service.concluido ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>

                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 text-center min-w-[60px]">
                                                    <span className="block text-lg font-bold text-white leading-none">
                                                        {new Date(service._parsedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-blue-400 font-medium text-sm">
                                                        <User className="w-3.5 h-3.5" />
                                                        {service.passageiro || 'Passageiro'}
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full ${service.concluido ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                                                        {service.concluido ? 'Viagem Realizada' : 'Para Realizar'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pl-2">
                                            <div className="relative">
                                                {/* Connecting Line */}
                                                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-700"></div>

                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 relative z-10 ring-4 ring-slate-800"></div>
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Origem</span>
                                                        <p className="text-white leading-tight">{service.origem}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3">
                                                    <div className="w-3 h-3 rounded-full bg-purple-500 mt-1.5 relative z-10 ring-4 ring-slate-800"></div>
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Destino</span>
                                                        <p className="text-white font-medium leading-tight">{service.destino}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {service.obs && (
                                                <div className="mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex gap-2">
                                                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-400 italic">"{service.obs}"</p>
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
