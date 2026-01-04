import { Calendar, MapPin, Clock, Info, CheckCircle, Navigation } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface Service {
    id: string;
    origem: string;
    destino: string;
    hora: string;
    data: string; // Assuming 'data' or 'hora' holds the date
    motoristaId: string;
    vehicleId?: string;
    status?: string;
    obs?: string;
    concluido?: boolean;
}

interface MyScheduleViewProps {
    services: Service[];
}

export default function MyScheduleView({ services }: MyScheduleViewProps) {
    // Group services by date
    const groupedServices = services.reduce((groups, service) => {
        // Extract date from service.hora (assuming ISO string or YYYY-MM-DD THH:mm) or service.data
        // Fallback to today if parsing fails for robustness
        let dateKey = 'Data Inválida';
        try {
            const dateObj = new Date(service.hora || new Date());
            dateKey = dateObj.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (e) {
            console.error('Date parsing error', e);
        }

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(service);
        return groups;
    }, {} as Record<string, Service[]>);

    // Sort dates? Object keys iteration order isn't guaranteed, but usually follows insertion. 
    // Better to have sorted keys array.
    const sortedDates = Object.keys(groupedServices).sort((a, b) => {
        // Simple comparison might not work for localized strings. 
        // For a robust app, we'd use the raw date string as key then format for display.
        // But for this quick implementation, let's trust the input order or simple sort.
        // Actually, let's reverse to show arguably newest/future? 
        // Ideally we want chronological.
        // Let's rely on the incoming `services` being sorted by date from the parent.
        return 0;
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Minha Escala
                </h2>
                <span className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    {services.length} serviços agendados
                </span>
            </div>

            {services.length === 0 ? (
                <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50 border-dashed">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Sem serviços agendados</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">
                        Não tens serviços atribuídos para os próximos dias. Desfruta do teu descanso!
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {sortedDates.map(date => (
                        <div key={date} className="space-y-4">
                            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider pl-1 border-l-2 border-blue-500">
                                {date}
                            </h3>

                            <div className="grid gap-4">
                                {groupedServices[date].map(service => (
                                    <div
                                        key={service.id}
                                        className="bg-slate-800/50 hover:bg-slate-800 transition-colors rounded-xl p-5 border border-slate-700/50 relative overflow-hidden group"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600"></div>

                                        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
                                            {/* Time */}
                                            <div className="flex flex-col items-center justify-center bg-slate-900/50 p-3 rounded-lg min-w-[80px]">
                                                <span className="text-xl font-bold text-white">
                                                    {new Date(service.hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[10px] text-slate-500 uppercase font-medium">Horário</span>
                                            </div>

                                            {/* Route Info */}
                                            <div className="space-y-2">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                        <span className="text-slate-300 text-sm">De:</span>
                                                        <span className="text-white font-medium">{service.origem}</span>
                                                    </div>
                                                    <div className="hidden sm:block text-slate-600">
                                                        <Navigation className="w-3 h-3 rotate-90" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                        <span className="text-slate-300 text-sm">Para:</span>
                                                        <span className="text-white font-medium">{service.destino}</span>
                                                    </div>
                                                </div>

                                                {service.obs && (
                                                    <div className="flex items-start gap-2 bg-slate-900/30 p-2 rounded-lg mt-2">
                                                        <Info className="w-4 h-4 text-slate-500 mt-0.5" />
                                                        <p className="text-xs text-slate-400 italic">"{service.obs}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Status / Action */}
                                            <div className="flex items-center justify-end">
                                                {service.concluido ? (
                                                    <div className="flex items-center gap-2 text-emerald-400 px-4 py-2 bg-emerald-500/10 rounded-lg">
                                                        <CheckCircle className="w-5 h-5" />
                                                        <span className="font-medium text-sm">Concluído</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-amber-400 px-4 py-2 bg-amber-500/10 rounded-lg">
                                                        <Clock className="w-5 h-5" />
                                                        <span className="font-medium text-sm">Agendado</span>
                                                    </div>
                                                )}
                                            </div>
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
