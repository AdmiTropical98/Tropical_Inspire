
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense, Fatura, FinancialSummary, TollRecord, ElectricChargingRecord } from '../types';

interface FinancialContextType {
    expenses: Expense[];
    invoices: Fatura[];
    summary: FinancialSummary;
    tolls: TollRecord[];
    charging: ElectricChargingRecord[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
    addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [invoices, setInvoices] = useState<Fatura[]>([]);
    const [tolls, setTolls] = useState<TollRecord[]>([]);
    const [charging, setCharging] = useState<ElectricChargingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState<FinancialSummary>({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingPayments: 0,
        expenseBreakdown: [],
        topCostCenters: []
    });

    const refreshData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchExpenses(),
                fetchInvoices(),
                calculateSummary()
            ]);
        } catch (error) {
            console.error('Error refreshing financial data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchExpenses = async () => {
        // Fetch explicit expenses
        const { data: dbExpenses } = await supabase.from('expenses').select('*');
        const explicitExpenses: Expense[] = dbExpenses || [];

        // Fetch Implicit Expenses from other modules
        // 1. Fuel
        const { data: fuel } = await supabase.from('fuel_transactions').select('*');
        const fuelExpenses: Expense[] = (fuel || []).map((f: any) => ({
            id: `fuel-${f.id}`,
            category: 'variavel',
            description: `Abastecimento - ${f.vehicleId || 'Viatura'}`,
            amount: f.total_cost || 0,
            date: f.timestamp,
            paid: true, // Assumed paid instantly via card usually
            recurring: false,
            cost_center_id: f.centro_custo_id
        }));

        // 2. Maintenance
        const { data: maint } = await supabase.from('viaturas_manutencoes').select('*');
        const maintExpenses: Expense[] = (maint || []).map((m: any) => ({
            id: `maint-${m.id}`,
            category: 'variavel',
            description: `Manutenção - ${m.tipo}`,
            amount: m.custo || 0,
            date: m.data,
            paid: true,
            recurring: false,
            // no CC usually on maint table directly, would need join, ignoring for MVP
        }));

        // 3. Requisitions (Confirmed)
        const { data: reqs } = await supabase.from('requisicoes').select('*').eq('status', 'concluida').not('custo', 'is', null);
        const reqExpenses: Expense[] = (reqs || []).map((r: any) => ({
            id: `req-${r.id}`,
            category: 'variavel',
            description: `Requisição #${r.numero} - ${r.fornecedorId}`, // Should map supplier name
            amount: r.custo || 0,
            date: r.data,
            paid: false, // Often on credit
            recurring: false,
            cost_center_id: r.centroCustoId
        }));

        // 4. Salaries (Base + Manual Hours)
        const { data: drivers } = await supabase.from('motoristas').select('*');
        const { data: manuals } = await supabase.from('manual_hours').select('*');

        const salaryExpenses: Expense[] = [];
        const manualHourExpenses: Expense[] = [];

        if (drivers) {
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            // A. Base Salary (Current Month Only for "Run Rate" visualization)
            drivers.forEach((d: any) => {
                if (d.vencimento_base && d.vencimento_base > 0 && d.centro_custo_id) {
                    salaryExpenses.push({
                        id: `salary-${d.id}-${now.getMonth() + 1}${now.getFullYear()}`,
                        category: 'salario',
                        description: `Vencimento Base - ${d.nome}`,
                        amount: d.vencimento_base,
                        date: currentMonthStart,
                        paid: false, // Usually paid at end of month
                        recurring: true,
                        recurrence_period: 'monthly',
                        cost_center_id: d.centro_custo_id
                    });
                }
            });

            // B. Manual Hours
            if (manuals) {
                manuals.forEach((m: any) => {
                    const driver = drivers.find((d: any) => d.id === m.motorista_id);
                    if (driver && driver.valor_hora && driver.valor_hora > 0) {
                        // Calculate duration
                        const start = new Date(`1970-01-01T${m.start_time}`);
                        const end = new Date(`1970-01-01T${m.end_time}`);
                        let diffInfo = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
                        if (diffInfo < 0) diffInfo += 24; // Handle overnight

                        // Subtract break
                        const duration = diffInfo - ((m.break_duration || 0) / 60);

                        if (duration > 0) {
                            const cost = duration * driver.valor_hora;
                            manualHourExpenses.push({
                                id: `manual-hour-${m.id}`,
                                category: 'salario', // or 'variavel'
                                description: `Horas Extras (${m.date}) - ${driver.nome}`,
                                amount: cost,
                                date: m.date, // Expense date = work date
                                paid: false,
                                recurring: false,
                                cost_center_id: driver.centro_custo_id
                            });
                        }
                    }
                });
            }
        }

        // 5. Via Verde (Tolls & Parking)
        const { data: tollsData } = await supabase.from('via_verde_toll_records').select('*');
        if (tollsData) setTolls(tollsData);

        const tollExpenses: Expense[] = (tollsData || []).map((t: any) => ({
            id: `toll-${t.id}`,
            category: 'variavel',
            description: t.type === 'parking' ? `Estacionamento - ${t.entry_point}` : `Portagem - ${t.entry_point} -> ${t.exit_point}`,
            amount: t.amount || 0,
            date: t.entry_time, // usage date
            paid: true, // Auto-debit
            recurring: false,
            cost_center_id: t.cost_center_id
        }));

        // 6. Electric Charging
        const { data: chargingData } = await supabase.from('electric_charging_records').select('*');
        if (chargingData) setCharging(chargingData);

        const chargingExpenses: Expense[] = (chargingData || []).map((c: any) => ({
            id: `charge-${c.id}`,
            category: 'variavel',
            description: `Carregamento - ${c.station_name}`,
            amount: c.cost || 0,
            date: c.date,
            paid: true, // Usually card/app
            recurring: false,
            cost_center_id: c.cost_center_id
        }));

        setExpenses([...explicitExpenses, ...fuelExpenses, ...maintExpenses, ...reqExpenses, ...salaryExpenses, ...manualHourExpenses, ...tollExpenses, ...chargingExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };

    const fetchInvoices = async () => {
        const { data } = await supabase.from('faturas').select('*').order('data', { ascending: false });
        if (data) setInvoices(data);
    };

    const calculateSummary = async () => {
        // Calculation logic triggers after state updates or we do it inline with data we just fetched.
        // Since fetchExpenses logic is complex, let's reuse the calculated arrays if possible or simpler: rely on `expenses` state in useEffect?
        // Better: calculate immediately with newly fetched data
    };

    // Actually, calculateSummary needs the data. Let's make refreshData do the heavy lifting.

    // Refactored refreshData logic inside:
    useEffect(() => {
        const load = async () => {
            // ... Fetch Logic duplicated for clarity or extracted
            // Let's implement full logic in next step or use simple version here.
            await refreshData();
        };
        load();
    }, []);

    // Helper to calc stats from current lists (which might be empty initially)
    useEffect(() => {
        if (!invoices.length && !expenses.length) return;

        const totalRevenue = invoices.reduce((acc, curr) => acc + (curr.total || 0), 0);
        const totalExpensesVal = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const pending = invoices.filter(i => i.status !== 'paga' && i.status !== 'anulada').reduce((acc, curr) => acc + (curr.total || 0), 0);

        // Breakdown
        const breakdown = [
            { category: 'Combustível & Energia', value: expenses.filter(e => e.id.startsWith('fuel-') || e.id.startsWith('charge-')).reduce((sum, e) => sum + e.amount, 0), color: 'bg-blue-500' },
            { category: 'Manutenção', value: expenses.filter(e => e.id.startsWith('maint-')).reduce((sum, e) => sum + e.amount, 0), color: 'bg-red-500' },
            { category: 'Via Verde', value: expenses.filter(e => e.id.startsWith('toll-')).reduce((sum, e) => sum + e.amount, 0), color: 'bg-emerald-500' },
            { category: 'Requisições', value: expenses.filter(e => e.id.startsWith('req-')).reduce((sum, e) => sum + e.amount, 0), color: 'bg-amber-500' },
            { category: 'Fixos/Outros', value: expenses.filter(e => !e.id.match(/^(fuel|maint|req|toll|charge)-/)).reduce((sum, e) => sum + e.amount, 0), color: 'bg-indigo-500' },
        ];

        // Top CC
        const ccStats: Record<string, number> = {};
        expenses.forEach(e => {
            if (e.cost_center_id) {
                ccStats[e.cost_center_id] = (ccStats[e.cost_center_id] || 0) + e.amount;
            }
        });

        // This requires CC names. For now just IDs or fetch them.
        // Simplified:
        const topCostCenters = Object.entries(ccStats).map(([id, total]) => ({ id, nome: 'Loading...', total })).sort((a, b) => b.total - a.total).slice(0, 5);

        setSummary({
            totalRevenue,
            totalExpenses: totalExpensesVal,
            netProfit: totalRevenue - totalExpensesVal,
            pendingPayments: pending,
            expenseBreakdown: breakdown,
            topCostCenters
        });

    }, [invoices, expenses]);


    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        const { error } = await supabase.from('expenses').insert(expense);
        if (error) throw error;
        await refreshData();
    };

    const updateExpense = async (id: string, updates: Partial<Expense>) => {
        const { error } = await supabase.from('expenses').update(updates).eq('id', id);
        if (error) throw error;
        await refreshData();
    };

    const deleteExpense = async (id: string) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        await refreshData();
    };

    return (
        <FinancialContext.Provider value={{
            expenses, invoices, summary, tolls, charging, isLoading,
            refreshData, addExpense, updateExpense, deleteExpense
        }}>
            {children}
        </FinancialContext.Provider>
    );
};

export const useFinancial = () => {
    const context = useContext(FinancialContext);
    if (!context) throw new Error('useFinancial must be used within a FinancialProvider');
    return context;
};
