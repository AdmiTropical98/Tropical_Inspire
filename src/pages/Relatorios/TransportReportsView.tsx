import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BusFront, Building2, CalendarDays, Users } from 'lucide-react';

interface HotelRow {
    month: string;
    hotel: string;
    total_transportes: number;
    funcionarios_transportados: number;
    viagens_realizadas: number;
}

interface EmployeeTripRow {
    employee_id: string;
    hotel_name: string | null;
    trip_date: string;
    transport_price_per_day: number;
    service_passengers?: {
        employee_name: string;
    }[] | null;
}

interface EmployeeReportRow {
    employeeId: string;
    employeeName: string;
    transportDays: number;
    totalCost: number;
}

const monthStartIso = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
const monthEndIso = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

export default function TransportReportsView() {
    const [baseDate, setBaseDate] = useState(new Date());
    const [selectedHotel, setSelectedHotel] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [hotels, setHotels] = useState<HotelRow[]>([]);
    const [employeeRows, setEmployeeRows] = useState<EmployeeReportRow[]>([]);

    const monthStart = useMemo(() => monthStartIso(baseDate), [baseDate]);
    const monthEnd = useMemo(() => monthEndIso(baseDate), [baseDate]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data: hotelData } = await supabase
                    .from('vw_transport_stats_by_hotel_monthly')
                    .select('month, hotel, total_transportes, funcionarios_transportados, viagens_realizadas')
                    .eq('month', monthStart)
                    .order('viagens_realizadas', { ascending: false })
                    .limit(50);

                setHotels((hotelData || []) as HotelRow[]);

                let tripQuery = supabase
                    .from('passenger_trips')
                    .select('employee_id, hotel_name, trip_date, transport_price_per_day, service_passengers(employee_name)')
                    .gte('trip_date', monthStart)
                    .lte('trip_date', monthEnd)
                    .order('trip_date', { ascending: false })
                    .limit(5000);

                if (selectedHotel !== 'all') {
                    tripQuery = tripQuery.eq('hotel_name', selectedHotel);
                }

                const { data: trips } = await tripQuery;

                const byEmployee = new Map<string, { name: string; days: Set<string>; totalCost: number }>();

                (trips as EmployeeTripRow[] || []).forEach((row) => {
                    const current = byEmployee.get(row.employee_id) || {
                        name: row.service_passengers?.[0]?.employee_name || row.employee_id,
                        days: new Set<string>(),
                        totalCost: 0
                    };

                    current.days.add(row.trip_date);
                    current.totalCost += Number(row.transport_price_per_day || 0);
                    byEmployee.set(row.employee_id, current);
                });

                const employees: EmployeeReportRow[] = Array.from(byEmployee.entries())
                    .map(([employeeId, values]) => ({
                        employeeId,
                        employeeName: values.name,
                        transportDays: values.days.size,
                        totalCost: values.totalCost
                    }))
                    .sort((a, b) => b.totalCost - a.totalCost);

                setEmployeeRows(employees);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [monthStart, monthEnd, selectedHotel]);

    const hotelOptions = useMemo(() => {
        return ['all', ...hotels.map(h => h.hotel).filter(Boolean)];
    }, [hotels]);

    const totals = useMemo(() => {
        return hotels.reduce((acc, row) => {
            acc.totalTransportes += Number(row.total_transportes || 0);
            acc.funcionarios += Number(row.funcionarios_transportados || 0);
            acc.viagens += Number(row.viagens_realizadas || 0);
            return acc;
        }, { totalTransportes: 0, funcionarios: 0, viagens: 0 });
    }, [hotels]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase text-slate-400"><BusFront className="h-4 w-4" />Transportes</div>
                    <div className="text-2xl font-black text-white">{totals.totalTransportes}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase text-slate-400"><Users className="h-4 w-4" />Funcionários</div>
                    <div className="text-2xl font-black text-white">{totals.funcionarios}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase text-slate-400"><Building2 className="h-4 w-4" />Viagens</div>
                    <div className="text-2xl font-black text-white">{totals.viagens}</div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-300">
                        <span className="mb-1 flex items-center gap-2 text-xs uppercase text-slate-400"><CalendarDays className="h-4 w-4" />Mês</span>
                        <input
                            type="month"
                            value={`${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`}
                            onChange={(e) => {
                                const [y, m] = e.target.value.split('-').map(Number);
                                if (y && m) setBaseDate(new Date(y, m - 1, 1));
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                        />
                    </label>
                    <label className="text-sm text-slate-300">
                        <span className="mb-1 block text-xs uppercase text-slate-400">Hotel</span>
                        <select
                            value={selectedHotel}
                            onChange={(e) => setSelectedHotel(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                        >
                            {hotelOptions.map(option => (
                                <option key={option} value={option}>{option === 'all' ? 'Todos os hotéis' : option}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {loading ? (
                    <p className="text-sm text-slate-400">A carregar relatório de transporte...</p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-sm font-bold text-white">Estatísticas por Hotel</h3>
                            <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Hotel</th>
                                            <th className="px-3 py-2 text-right">Transportes</th>
                                            <th className="px-3 py-2 text-right">Funcionários</th>
                                            <th className="px-3 py-2 text-right">Viagens</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {hotels.map((row) => (
                                            <tr key={`${row.month}-${row.hotel}`}>
                                                <td className="px-3 py-2 text-slate-200">{row.hotel}</td>
                                                <td className="px-3 py-2 text-right text-white">{row.total_transportes}</td>
                                                <td className="px-3 py-2 text-right text-white">{row.funcionarios_transportados}</td>
                                                <td className="px-3 py-2 text-right text-white">{row.viagens_realizadas}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-2 text-sm font-bold text-white">Custo por Funcionário</h3>
                            <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Funcionário</th>
                                            <th className="px-3 py-2 text-right">Dias</th>
                                            <th className="px-3 py-2 text-right">Custo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {employeeRows.map((row) => (
                                            <tr key={row.employeeId}>
                                                <td className="px-3 py-2 text-slate-200">{row.employeeName}</td>
                                                <td className="px-3 py-2 text-right text-white">{row.transportDays}</td>
                                                <td className="px-3 py-2 text-right text-white">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(row.totalCost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}