
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense, Fatura, FinancialSummary, TollRecord, ElectricChargingRecord, SupplierInvoice, FinancialMovement } from '../types';

interface FinancialContextType {
    expenses: Expense[];
    invoices: Fatura[];
    supplierInvoices: SupplierInvoice[];
    financialMovements: FinancialMovement[];
    summary: FinancialSummary;
    tolls: TollRecord[];
    charging: ElectricChargingRecord[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
    addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    addSupplierInvoice: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    updateSupplierInvoice: (id: string, updates: Partial<SupplierInvoice>) => Promise<void>;
    deleteSupplierInvoice: (id: string) => Promise<void>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

    const getEstimatedRequisitionValue = (requisition: { itens?: any[] }) => {
        const items = Array.isArray(requisition.itens) ? requisition.itens : [];
        return round2(items.reduce((sum, item) => {
            const lineTotal = Number(item?.valor_total ?? 0);
            if (Number.isFinite(lineTotal) && lineTotal > 0) return sum + lineTotal;

            const quantity = Number(item?.quantidade ?? 0);
            const unitPrice = Number(item?.valor_unitario ?? 0);
            if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && quantity > 0 && unitPrice > 0) {
                return sum + (quantity * unitPrice);
            }

            return sum;
        }, 0));
    };

    const getRequisitionFinancialStatus = (totalInvoiced: number, estimatedValue: number): 'PENDING' | 'PARTIAL' | 'INVOICED' => {
        const safeTotalInvoiced = round2(Math.max(0, totalInvoiced));
        const safeEstimatedValue = round2(Math.max(0, estimatedValue));

        if (safeTotalInvoiced === 0) return 'PENDING';
        if (safeEstimatedValue <= 0) return 'INVOICED';
        if (safeTotalInvoiced < safeEstimatedValue) return 'PARTIAL';
        return 'INVOICED';
    };

    const syncRequisitionFinancialStatus = async (requisitionId?: string) => {
        if (!requisitionId) return;

        try {
            const { data: requisitionData, error: requisitionError } = await supabase
                .from('requisicoes')
                .select('id,itens')
                .eq('id', requisitionId)
                .maybeSingle();

            if (requisitionError || !requisitionData) {
                if (requisitionError) {
                    console.warn('Unable to fetch requisition for financial sync:', requisitionError.message);
                }
                return;
            }

            const { data: linkedInvoices, error: linkedInvoicesError } = await supabase
                .from('supplier_invoices')
                .select('total_final,total,total_value')
                .eq('requisition_id', requisitionId);

            if (linkedInvoicesError) {
                console.warn('Unable to fetch linked invoices for requisition sync:', linkedInvoicesError.message);
                return;
            }

            const totalInvoiced = round2((linkedInvoices || []).reduce((sum, invoice: any) => {
                const total = Number(invoice?.total_final ?? invoice?.total ?? invoice?.total_value ?? 0);
                return sum + (Number.isFinite(total) ? total : 0);
            }, 0));

            const estimatedValue = getEstimatedRequisitionValue(requisitionData);
            const financialStatus = getRequisitionFinancialStatus(totalInvoiced, estimatedValue);

            const { error: updateError } = await supabase
                .from('requisicoes')
                .update({
                    financial_status: financialStatus,
                    total_invoiced_amount: totalInvoiced
                })
                .eq('id', requisitionId);

            if (updateError) {
                console.warn('Unable to update requisition financial status:', updateError.message);
            }
        } catch (error) {
            console.warn('Unexpected error while syncing requisition financial status:', error);
        }
    };

    const computeInvoiceFromLines = (lines: NonNullable<SupplierInvoice['lines']>) => {
        const normalizedLines = lines
            .map(line => {
                const quantity = round2(line.quantity || 0);
                const inferredUnitPrice = line.unit_price ?? (quantity !== 0 ? (line.net_value || 0) / quantity : (line.net_value || 0));
                const unitPrice = round2(inferredUnitPrice || 0);
                const discountPercentage = Math.max(0, round2(line.discount_percentage || 0));
                const subtotal = round2(quantity * unitPrice);
                const discountValue = round2(subtotal * (discountPercentage / 100));
                const netValue = round2(subtotal - discountValue);
                const ivaRate = line.iva_rate || 0;
                const calculatedIvaValue = round2(netValue * (ivaRate / 100));
                const providedIvaValue = round2(Number(line.iva_value || 0));
                const ivaValue = Math.abs(providedIvaValue - calculatedIvaValue) >= 0.01
                    ? providedIvaValue
                    : calculatedIvaValue;
                return {
                    ...line,
                    quantity,
                    unit_price: unitPrice,
                    discount_percentage: discountPercentage,
                    subtotal,
                    discount_value: discountValue,
                    net_value: netValue,
                    iva_rate: ivaRate,
                    iva_value: ivaValue,
                    total_value: round2(netValue + ivaValue)
                };
            })
            .filter(line => line.description.trim() && line.net_value !== 0);

        const grossBaseTotal = round2(normalizedLines.reduce((sum, line) => sum + line.subtotal, 0));
        const discountTotal = round2(normalizedLines.reduce((sum, line) => sum + line.discount_value, 0));
        const totalLiquido = round2(normalizedLines.reduce((sum, line) => sum + line.net_value, 0));
        const totalIva = round2(normalizedLines.reduce((sum, line) => sum + line.iva_value, 0));
        const totalFinal = round2(totalLiquido + totalIva);

        return { normalizedLines, grossBaseTotal, discountTotal, totalLiquido, totalIva, totalFinal };
    };

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [invoices, setInvoices] = useState<Fatura[]>([]);
    const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
    const [financialMovements, setFinancialMovements] = useState<FinancialMovement[]>([]);
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
                fetchSupplierInvoices(),
                fetchFinancialMovements(),
                calculateSummary()
            ]);
        } catch (error) {
            console.error('Error refreshing financial data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

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

    const fetchSupplierInvoices = async () => {
        const { data } = await supabase
            .from('supplier_invoices')
            .select(`
                *,
                supplier:fornecedores(*),
                cost_center:centros_custos(*),
                vehicle:viaturas(matricula, marca, modelo),
                requisition:requisicoes(id, numero, status),
                lines:supplier_invoice_lines(*)
            `)
            .order('issue_date', { ascending: false });
        if (data) setSupplierInvoices(data as SupplierInvoice[]);
    };

    const fetchFinancialMovements = async () => {
        const { data } = await supabase
            .from('financial_movements')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (data) setFinancialMovements(data as FinancialMovement[]);
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

    // ERP summary based only on financial movements
    useEffect(() => {
        const totalRevenue = round2(financialMovements
            .filter(m => m.type === 'revenue')
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0));

        const totalExpensesVal = round2(financialMovements
            .filter(m => m.type === 'expense')
            .reduce((acc, curr) => acc + Number(curr.amount || 0), 0));

        const byAccount = (accountCode: FinancialMovement['account_code']) => round2(financialMovements
            .filter(m => m.type === 'expense' && m.account_code === accountCode)
            .reduce((sum, m) => sum + Number(m.amount || 0), 0));

        const breakdown = [
            { category: 'Combustível', value: byAccount('61'), color: 'bg-blue-500' },
            { category: 'Manutenção', value: byAccount('62'), color: 'bg-red-500' },
            { category: 'Portagens', value: byAccount('63'), color: 'bg-emerald-500' },
            { category: 'Despesas Gerais', value: byAccount('64'), color: 'bg-indigo-500' },
        ];

        const ccStats: Record<string, number> = {};
        financialMovements.forEach(movement => {
            if (!movement.cost_center_id) return;
            ccStats[movement.cost_center_id] = (ccStats[movement.cost_center_id] || 0) + Number(movement.amount || 0);
        });

        const topCostCenters = Object.entries(ccStats)
            .map(([id, total]) => ({ id, nome: id, total: round2(total) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        setSummary({
            totalRevenue,
            totalExpenses: totalExpensesVal,
            netProfit: totalRevenue - totalExpensesVal,
            pendingPayments: 0,
            expenseBreakdown: breakdown,
            topCostCenters
        });

    }, [financialMovements]);


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

    const addSupplierInvoice = async (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => {
        const { lines = [], ...invoiceData } = invoice;
        const { normalizedLines, grossBaseTotal, discountTotal, totalLiquido, totalIva, totalFinal } = computeInvoiceFromLines(lines);

        if (!normalizedLines.length) {
            throw new Error('Invoice must include at least one non-zero line.');
        }

        const normalizedInvoiceData = {
            ...invoiceData,
            base_amount: grossBaseTotal,
            iva_value: totalIva,
            total: totalFinal,
            total_liquido: totalLiquido,
            total_iva: totalIva,
            total_final: totalFinal,
            net_value: totalLiquido,
            vat_value: totalIva,
            total_value: totalFinal,
            discount: { type: 'amount', value: discountTotal, applied_value: discountTotal },
            extra_expenses: []
        };

        const { data: createdInvoice, error: invoiceError } = await supabase
            .from('supplier_invoices')
            .insert(normalizedInvoiceData)
            .select('id')
            .single();

        if (invoiceError) throw invoiceError;

        if (normalizedLines.length > 0) {
            const lineRows = normalizedLines.map(line => ({
                supplier_invoice_id: createdInvoice.id,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
                discount_percentage: line.discount_percentage,
                net_value: line.net_value,
                iva_rate: line.iva_rate,
                iva_value: line.iva_value,
                total_value: line.total_value
            }));

            const { error: linesError } = await supabase.from('supplier_invoice_lines').insert(lineRows);
            if (linesError) {
                await supabase.from('supplier_invoices').delete().eq('id', createdInvoice.id);
                throw linesError;
            }
        }

        await syncRequisitionFinancialStatus(invoiceData.requisition_id);

        await refreshData();
    };

    const updateSupplierInvoice = async (id: string, updates: Partial<SupplierInvoice>) => {
        const { lines, ...invoiceData } = updates;
        const existingInvoice = supplierInvoices.find(invoice => invoice.id === id);

        let normalizedInvoiceData = { ...invoiceData };
        let normalizedLines: NonNullable<SupplierInvoice['lines']> | undefined;

        if (lines) {
            const computed = computeInvoiceFromLines(lines);
            normalizedLines = computed.normalizedLines;

            if (!normalizedLines.length) {
                throw new Error('Invoice must include at least one non-zero line.');
            }

            normalizedInvoiceData = {
                ...normalizedInvoiceData,
                base_amount: computed.grossBaseTotal,
                iva_value: computed.totalIva,
                total: computed.totalFinal,
                total_liquido: computed.totalLiquido,
                total_iva: computed.totalIva,
                total_final: computed.totalFinal,
                net_value: computed.totalLiquido,
                vat_value: computed.totalIva,
                total_value: computed.totalFinal,
                discount: { type: 'amount', value: computed.discountTotal, applied_value: computed.discountTotal },
                extra_expenses: []
            };
        }

        const { error: invoiceError } = await supabase.from('supplier_invoices').update(normalizedInvoiceData).eq('id', id);
        if (invoiceError) throw invoiceError;

        if (lines) {
            const { error: deleteLinesError } = await supabase
                .from('supplier_invoice_lines')
                .delete()
                .eq('supplier_invoice_id', id);

            if (deleteLinesError) throw deleteLinesError;

            if (normalizedLines && normalizedLines.length > 0) {
                const lineRows = normalizedLines.map(line => ({
                    supplier_invoice_id: id,
                    description: line.description,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    discount_percentage: line.discount_percentage,
                    net_value: line.net_value,
                    iva_rate: line.iva_rate,
                    iva_value: line.iva_value,
                    total_value: line.total_value
                }));

                const { error: insertLinesError } = await supabase.from('supplier_invoice_lines').insert(lineRows);
                if (insertLinesError) throw insertLinesError;
            }
        }

        const previousRequisitionId = existingInvoice?.requisition_id;
        const nextRequisitionId = normalizedInvoiceData.requisition_id ?? previousRequisitionId;

        if (previousRequisitionId && previousRequisitionId !== nextRequisitionId) {
            await syncRequisitionFinancialStatus(previousRequisitionId);
        }
        await syncRequisitionFinancialStatus(nextRequisitionId);

        await refreshData();
    };

    const deleteSupplierInvoice = async (id: string) => {
        const existingInvoice = supplierInvoices.find(invoice => invoice.id === id);
        const { error } = await supabase.from('supplier_invoices').delete().eq('id', id);
        if (error) throw error;

        await syncRequisitionFinancialStatus(existingInvoice?.requisition_id);
        await refreshData();
    };

    return (
        <FinancialContext.Provider value={{
            expenses, invoices, supplierInvoices, financialMovements, summary, tolls, charging, isLoading,
            refreshData, addExpense, updateExpense, deleteExpense,
            addSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice
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
