import React, { useMemo, useState } from 'react';
import { History, Fuel, ArrowDownToLine, Calendar, Car, Truck } from 'lucide-react';
import { useWorkshop } from '../../../contexts/WorkshopContext';

const HistoricoOficina: React.FC = () => {
    const { fuelTransactions, tankRefills, viaturas } = useWorkshop();
    const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const getVehiclePlate = (id: string) => {
        const v = viaturas.find(v => v.id === id);
        return v ? v.matricula : 'Desconhecida';
    };

    const combinedHistory = useMemo(() => {
        // Map transactions
        const txs = fuelTransactions
            .filter(t => !t.isExternal && t.status === 'confirmed')
            .map(t => ({
                id: t.id,
                type: 'abastecimento' as const,
                timestamp: new Date(t.timestamp),
                liters: t.liters,
                km: t.km,
                vehicleId: t.vehicleId,
                staffName: t.staffName || 'Operador',
            }));

        // Map tank refills
        const refills = tankRefills.map(r => ({
            id: r.id,
            type: 'entrada' as const,
            timestamp: new Date(r.timestamp),
            liters: r.litersAdded,
            supplier: r.supplier,
            totalCost: r.totalCost || r.totalSpentSinceLast,
            staffName: r.staffName || 'Operador',
        }));

        // Combine and sort by date descending
        const all = [...txs, ...refills].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        // Filter by selected date
        return all.filter(item => {
            const itemDate = item.timestamp.toISOString().split('T')[0];
            return itemDate === filterDate;
        });
    }, [fuelTransactions, tankRefills, filterDate]);

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-amber-600 p-6 text-white shrink-0 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black flex items-center gap-4">
                        <History className="w-10 h-10 text-amber-200" />
                        Histórico da Oficina
                    </h2>
                    <p className="text-amber-100 mt-2 text-lg">Consulta rápida dos movimentos diários do depósito.</p>
                </div>
                <div className="bg-amber-700/50 p-2 rounded-2xl border border-amber-500/30">
                    <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-transparent text-white font-bold text-xl outline-none [&::-webkit-calendar-picker-indicator]:invert"
                    />
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                {combinedHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Calendar className="w-20 h-20 mb-4 opacity-20" />
                        <p className="text-2xl font-bold">Sem movimentos neste dia.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {combinedHistory.map((item) => (
                            <div 
                                key={item.id} 
                                className={\`p-6 rounded-2xl border-2 flex items-center gap-6 shadow-sm transition-all \${
                                    item.type === 'abastecimento' 
                                    ? 'bg-white border-blue-100' 
                                    : 'bg-emerald-50/30 border-emerald-100'
                                }\`}
                            >
                                <div className={\`p-4 rounded-2xl shrink-0 \${
                                    item.type === 'abastecimento' 
                                    ? 'bg-blue-100 text-blue-600' 
                                    : 'bg-emerald-100 text-emerald-600'
                                }\`}>
                                    {item.type === 'abastecimento' ? (
                                        <Fuel className="w-8 h-8" />
                                    ) : (
                                        <ArrowDownToLine className="w-8 h-8" />
                                    )}
                                </div>
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={\`text-sm font-bold uppercase tracking-widest px-2 py-1 rounded-lg \${
                                            item.type === 'abastecimento' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                                        }\`}>
                                            {item.type === 'abastecimento' ? 'Saída (Abastecimento)' : 'Entrada (Fornecedor)'}
                                        </span>
                                        <span className="text-slate-400 font-medium">
                                            {item.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    
                                    {item.type === 'abastecimento' ? (
                                        <div className="flex items-center gap-4 text-xl font-bold text-slate-800">
                                            <Car className="w-6 h-6 text-slate-400" />
                                            {item.vehicleId ? getVehiclePlate(item.vehicleId) : 'Viatura N/D'}
                                            <span className="text-slate-300">•</span>
                                            <span className="text-slate-500">{item.km} km</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 text-xl font-bold text-slate-800">
                                            <Truck className="w-6 h-6 text-slate-400" />
                                            {item.supplier}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="text-right">
                                    <div className={\`text-4xl font-black \${
                                        item.type === 'abastecimento' ? 'text-blue-600' : 'text-emerald-600'
                                    }\`}>
                                        {item.type === 'abastecimento' ? '-' : '+'}{item.liters.toFixed(2)} <span className="text-2xl text-slate-400 font-bold">L</span>
                                    </div>
                                    <div className="text-slate-400 font-medium text-sm mt-1">
                                        Registo por: {item.staffName}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoricoOficina;
