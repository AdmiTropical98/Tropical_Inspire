
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense, Fatura, FinancialSummary, TollRecord, ElectricChargingRecord, SupplierInvoice, FinancialMovement } from '../types';
import { useWorkshop } from './WorkshopContext';

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
    addSupplierInvoice: (invoice: Omit<SupplierInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;
    updateSupplierInvoice: (id: string, updates: Partial<SupplierInvoice>) => Promise<string>;
    deleteSupplierInvoice: (id: string) => Promise<void>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { stockItems, createStockMovement } = useWorkshop();
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

    const extractMissingColumn = (error: any): string | null => {
        const message = String(error?.message || '');
        const details = String(error?.details || '');
        const combined = `${message}\n${details}`;

        const postgrestMatch = combined.match(/Could not find the '([^']+)' column/i);
        if (postgrestMatch?.[1]) return postgrestMatch[1];

        const postgresMatch = combined.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (postgresMatch?.[1]) return postgresMatch[1];

        return null;
    };

    const sanitizePayloadBySchema = async <T extends Record<string, any>>(
        operation: (payload: Partial<T>) => Promise<{ error: any; data?: any }>,
        initialPayload: Partial<T>,
        maxRetries = 12
    ) => {
        const payload: Partial<T> = { ...initialPayload };

        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
            const result = await operation(payload);
            if (!result.error) return result;

            const missingColumn = extractMissingColumn(result.error);
            if (!missingColumn || !(missingColumn in payload)) {
                throw result.error;
            }

            delete payload[missingColumn as keyof T];
        }

        throw new Error('Unable to execute database operation due to schema mismatch.');
    };

    const insertSupplierInvoiceLinesSafe = async (rows: Array<Record<string, any>>) => {
        if (!rows.length) return;

        let payloadRows = rows.map(row => ({ ...row }));
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const { error } = await supabase.from('supplier_invoice_lines').insert(payloadRows);
            if (!error) return;

            const missingColumn = extractMissingColumn(error);
            if (!missingColumn || !(missingColumn in payloadRows[0])) {
                throw error;
            }

            payloadRows = payloadRows.map(row => {
                const next = { ...row };
                delete next[missingColumn];
                return next;
            });
        }

        throw new Error('Unable to insert invoice lines due to schema mismatch.');
    };

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

    const getRequisitionErpStatus = (totalInvoiced: number, targetValue: number): 'pending' | 'awaiting_invoice' | 'invoiced' | 'closed' => {
        const safeTotalInvoiced = round2(Math.max(0, totalInvoiced));
        const safeTargetValue = round2(Math.max(0, targetValue));

        if (safeTotalInvoiced <= 0) return 'awaiting_invoice';
        if (safeTargetValue > 0 && safeTotalInvoiced < safeTargetValue) return 'invoiced';
        return 'closed';
    };

    const syncRequisitionFinancialStatus = async (requisitionId?: string) => {
        if (!requisitionId) return;

        try {
            const { data: requisitionData, error: requisitionError } = await supabase
                .from('requisicoes')
                .select('id,itens,approved_value,custo')
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

            const estimatedValue = round2(Number((requisitionData as any).approved_value ?? 0) || getEstimatedRequisitionValue(requisitionData));
            const financialStatus = getRequisitionFinancialStatus(totalInvoiced, estimatedValue);
            const erpStatus = getRequisitionErpStatus(totalInvoiced, estimatedValue);

            const { error: updateError } = await supabase
                .from('requisicoes')
                .update({
                    erp_status: erpStatus,
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
        const { data, error } = await supabase
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

        if (!error && data) {
            setSupplierInvoices(data as SupplierInvoice[]);
            return;
        }

        const { data: fallbackData } = await supabase
            .from('supplier_invoices')
            .select('*')
            .order('created_at', { ascending: false });

        if (fallbackData) setSupplierInvoices(fallbackData as SupplierInvoice[]);
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

    // ERP summary based only on financial movements (ledger as single source of truth)
    useEffect(() => {
        const ledgerAmount = (movement: FinancialMovement) => round2(Number(movement.debit || 0) - Number(movement.credit || 0));

        const totalRevenue = round2(financialMovements
            .filter(m => m.account_code.startsWith('7'))
            .reduce((acc, curr) => acc + (Number(curr.credit || 0) - Number(curr.debit || 0)), 0));

        const totalExpensesVal = round2(financialMovements
            .filter(m => m.account_code.startsWith('6'))
            .reduce((acc, curr) => acc + ledgerAmount(curr), 0));

        const byAccount = (accountCode: FinancialMovement['account_code']) => round2(financialMovements
            .filter(m => m.account_code === accountCode)
            .reduce((sum, movement) => sum + ledgerAmount(movement), 0));

        const breakdown = [
            { category: 'Combustível', value: byAccount('61'), color: 'bg-blue-500' },
            { category: 'Manutenção', value: byAccount('62'), color: 'bg-red-500' },
            { category: 'Portagens', value: byAccount('63'), color: 'bg-emerald-500' },
            { category: 'Serviços Externos', value: byAccount('64'), color: 'bg-indigo-500' },
        ];

        const ccStats: Record<string, number> = {};
        financialMovements.forEach(movement => {
            if (!movement.cost_center_id) return;
            const movementValue = movement.account_code.startsWith('6') ? ledgerAmount(movement) : 0;
            ccStats[movement.cost_center_id] = (ccStats[movement.cost_center_id] || 0) + movementValue;
        });

        const topCostCenters = Object.entries(ccStats)
            .map(([id, total]) => ({ id, nome: id, total: round2(total) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const pendingPayments = round2(Math.max(0, financialMovements
            .filter(m => m.account_code === '21')
            .reduce((sum, movement) => sum + (Number(movement.credit || 0) - Number(movement.debit || 0)), 0)));

        setSummary({
            totalRevenue,
            totalExpenses: totalExpensesVal,
            netProfit: totalRevenue - totalExpensesVal,
            pendingPayments,
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
            throw new Error('A fatura deve incluir pelo menos uma linha válida.');
        }

        const normalizedInvoiceData = {
            supplier_id: invoiceData.supplier_id,
            requisition_id: invoiceData.requisition_id || null,
            invoice_number: invoiceData.invoice_number,
            issue_date: invoiceData.issue_date,
            due_date: invoiceData.due_date,
            base_amount: grossBaseTotal,
            iva_value: totalIva,
            total: totalFinal, // Primary total
            total_liquido: totalLiquido,
            total_iva: totalIva,
            total_final: totalFinal, // Critical for ledger
            net_value: totalLiquido,
            vat_value: totalIva,
            total_value: totalFinal,
            discount: { type: 'amount', value: discountTotal, applied_value: discountTotal },
            expense_type: invoiceData.expense_type || 'Fatura Fornecedor',
            cost_center_id: invoiceData.cost_center_id || null,
            vehicle_id: invoiceData.vehicle_id || null,
            payment_status: invoiceData.payment_status || 'pending',
            payment_method: invoiceData.payment_method || null,
            notes: invoiceData.notes || null,
            pdf_url: invoiceData.pdf_url || null,
            extra_expenses: []
        };

        const { data: createdInvoice } = await sanitizePayloadBySchema(
            (payload) => supabase
                .from('supplier_invoices')
                .insert(payload)
                .select('id')
                .single(),
            normalizedInvoiceData
        );

        if (normalizedLines.length > 0) {
            const lineRows = normalizedLines.map(line => ({
                supplier_invoice_id: createdInvoice.id,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
                discount_percentage: line.discount_percentage,
                net_value: line.net_value,
                iva_rate: line.iva_rate as any,
                iva_value: line.iva_value,
                total_value: line.total_value
            }));

            try {
                await insertSupplierInvoiceLinesSafe(lineRows);
            } catch (linesError) {
                await supabase.from('supplier_invoices').delete().eq('id', createdInvoice.id);
                throw linesError;
            }

            for (const line of normalizedLines) {
                const stockItem = stockItems.find(wi =>
                    (wi.sku && line.description.toLowerCase().includes(wi.sku.toLowerCase())) ||
                    wi.name.toLowerCase() === line.description.toLowerCase()
                );

                if (stockItem) {
                    try {
                        await createStockMovement({
                            item_id: stockItem.id,
                            movement_type: 'entry',
                            quantity: line.quantity,
                            average_cost_at_time: line.unit_price,
                            source_document: 'invoice',
                            document_id: createdInvoice.id,
                            notes: `Fatura: ${normalizedInvoiceData.invoice_number}`
                        });
                    } catch (smError) {
                        console.warn('Non-critical error: Stock movement creation failed:', smError);
                    }
                }
            }
        }

        await syncRequisitionFinancialStatus(invoiceData.requisition_id);
        await refreshData();
        return createdInvoice.id as string;
    };

    const updateSupplierInvoice = async (id: string, updates: Partial<SupplierInvoice>) => {
        const { lines, ...invoiceData } = updates;
        const existingInvoice = supplierInvoices.find(invoice => invoice.id === id);
        let normalizedLines: any[] | undefined;

        let normalizedInvoiceData: any = {
            supplier_id: invoiceData.supplier_id,
            requisition_id: invoiceData.requisition_id,
            invoice_number: invoiceData.invoice_number,
            issue_date: invoiceData.issue_date,
            due_date: invoiceData.due_date,
            cost_center_id: invoiceData.cost_center_id,
            vehicle_id: invoiceData.vehicle_id,
            payment_status: invoiceData.payment_status,
            payment_method: invoiceData.payment_method,
            notes: invoiceData.notes,
            pdf_url: invoiceData.pdf_url,
            expense_type: invoiceData.expense_type
        };

        // Clean up undefined values to avoid updating to null unintentionally if not desired, 
        // however for foreign keys we might want to set to null.
        Object.keys(normalizedInvoiceData).forEach(key => {
            if (normalizedInvoiceData[key] === undefined) delete normalizedInvoiceData[key];
        });

        if (lines) {
            const computed = computeInvoiceFromLines(lines);
            normalizedLines = computed.normalizedLines;

            if (!normalizedLines || !normalizedLines.length) {
                throw new Error('A fatura deve incluir pelo menos uma linha válida.');
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

        await sanitizePayloadBySchema(
            (payload) => supabase.from('supplier_invoices').update(payload).eq('id', id),
            normalizedInvoiceData
        );

        if (lines) {

            const { error: deleteLinesError } = await supabase
                .from('supplier_invoice_lines')
                .delete()
                .eq('supplier_invoice_id', id);

            if (deleteLinesError) {
                console.error('Error cleaning up lines:', deleteLinesError);
                throw deleteLinesError;
            }

            if (normalizedLines && normalizedLines.length > 0) {
                const lineRows = (normalizedLines as any[]).map(line => ({
                    supplier_invoice_id: id,
                    description: line.description,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    discount_percentage: line.discount_percentage,
                    net_value: line.net_value,
                    iva_rate: line.iva_rate as any,
                    iva_value: line.iva_value,
                    total_value: line.total_value
                }));

                await insertSupplierInvoiceLinesSafe(lineRows);
            }
        }

        const previousRequisitionId = existingInvoice?.requisition_id;
        const nextRequisitionId = normalizedInvoiceData.requisition_id ?? previousRequisitionId;

        if (previousRequisitionId && previousRequisitionId !== nextRequisitionId) {
            await syncRequisitionFinancialStatus(previousRequisitionId);
        }
        await syncRequisitionFinancialStatus(nextRequisitionId);

        await refreshData();
        return id;
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
