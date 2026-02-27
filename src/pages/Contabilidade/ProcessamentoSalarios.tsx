import { useEffect, useMemo, useState } from 'react';
import { Calculator, Download, Save, PlusCircle, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';

interface PayrollRow {
    id?: string;
    driver_id: string;
    ordenado_base: number;
    horas_extra: number;
    valor_horas_extra: number;
    folgas_trabalhadas: number;
    valor_folgas: number;
    outros_abonos: number;
    descontos: number;
    total_bruto: number;
    observacoes: string;
}

const MONTHS = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
];

const calculateTotal = (row: PayrollRow) => {
    return (
        (row.ordenado_base || 0) +
        (row.valor_horas_extra || 0) +
        (row.valor_folgas || 0) +
        (row.outros_abonos || 0) -
        (row.descontos || 0)
    );
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type SourceField =
    | 'ordenado_base'
    | 'horas_extra'
    | 'valor_horas_extra'
    | 'folgas_trabalhadas'
    | 'valor_folgas'
    | 'outros_abonos'
    | 'descontos'
    | 'observacoes';

const recalculatePayrollRow = (row: PayrollRow, sourceField?: SourceField): PayrollRow => {
    const normalized: PayrollRow = {
        ...row,
        ordenado_base: round2(row.ordenado_base || 0),
        horas_extra: round2(row.horas_extra || 0),
        valor_horas_extra: round2(row.valor_horas_extra || 0),
        folgas_trabalhadas: round2(row.folgas_trabalhadas || 0),
        valor_folgas: round2(row.valor_folgas || 0),
        outros_abonos: round2(row.outros_abonos || 0),
        descontos: round2(row.descontos || 0)
    };

    const valorHora = normalized.ordenado_base > 0 ? normalized.ordenado_base / 173 : 0;
    const valorFolgaUnitaria = valorHora * 8;

    if (sourceField === 'valor_horas_extra') {
        normalized.horas_extra = round2(valorHora > 0 ? normalized.valor_horas_extra / valorHora : 0);
    } else if (sourceField === 'horas_extra' || sourceField === 'ordenado_base') {
        normalized.valor_horas_extra = round2(normalized.horas_extra * valorHora);
    }

    if (sourceField === 'valor_folgas') {
        normalized.folgas_trabalhadas = round2(valorFolgaUnitaria > 0 ? normalized.valor_folgas / valorFolgaUnitaria : 0);
    } else if (sourceField === 'folgas_trabalhadas' || sourceField === 'ordenado_base') {
        normalized.valor_folgas = round2(normalized.folgas_trabalhadas * valorFolgaUnitaria);
    }

    normalized.total_bruto = round2(calculateTotal(normalized));
    return normalized;
};

const isMissingPayrollTableError = (error: any) => {
    const message = (error?.message || '').toLowerCase();
    return message.includes('could not find the table') && message.includes('driver_payroll_manual');
};

export default function ProcessamentoSalarios() {
    const { motoristas } = useWorkshop();

    const today = new Date();
    const [mes, setMes] = useState(today.getMonth() + 1);
    const [ano, setAno] = useState(today.getFullYear());
    const [rows, setRows] = useState<PayrollRow[]>([]);
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
    const [showDriverPicker, setShowDriverPicker] = useState(false);
    const [driverSearch, setDriverSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPersistenceUnavailable, setIsPersistenceUnavailable] = useState(false);

    const motoristaById = useMemo(() => {
        return new Map(motoristas.map(m => [m.id, m.nome]));
    }, [motoristas]);

    const sortedMotoristas = useMemo(() => {
        return [...motoristas].sort((a, b) => a.nome.localeCompare(b.nome));
    }, [motoristas]);

    const createNewProcessing = () => {
        setRows([]);
        setSelectedDrivers([]);
        setShowDriverPicker(false);
        setDriverSearch('');
    };

    const loadProcessing = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('driver_payroll_manual')
            .select('*')
            .eq('mes', mes)
            .eq('ano', ano)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Erro ao carregar processamento salarial:', error);

            if (isMissingPayrollTableError(error)) {
                setIsPersistenceUnavailable(true);
                createNewProcessing();
                setIsLoading(false);
                return;
            }

            alert('Erro ao carregar processamento salarial: ' + error.message);
            setIsLoading(false);
            return;
        }

        setIsPersistenceUnavailable(false);

        if (data && data.length > 0) {
            const loadedRows = data.map((item: any) => {
                const row: PayrollRow = {
                    id: item.id,
                    driver_id: item.driver_id,
                    ordenado_base: Number(item.ordenado_base) || 0,
                    horas_extra: Number(item.horas_extra) || 0,
                    valor_horas_extra: Number(item.valor_horas_extra) || 0,
                    folgas_trabalhadas: Number(item.folgas_trabalhadas) || 0,
                    valor_folgas: Number(item.valor_folgas) || 0,
                    outros_abonos: Number(item.outros_abonos) || 0,
                    descontos: Number(item.descontos) || 0,
                    total_bruto: Number(item.total_bruto) || 0,
                    observacoes: item.observacoes || ''
                };
                return recalculatePayrollRow(row);
            });
            setRows(loadedRows);
            setSelectedDrivers(loadedRows.map(r => r.driver_id));
        } else {
            createNewProcessing();
        }

        setIsLoading(false);
    };

    useEffect(() => {
        if (sortedMotoristas.length > 0) {
            loadProcessing();
        }
    }, [mes, ano, sortedMotoristas.length]);

    const updateRow = (index: number, patch: Partial<PayrollRow>, sourceField?: SourceField) => {
        setRows(prev => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = recalculatePayrollRow({ ...next[index], ...patch }, sourceField);
            return next;
        });
    };

    const addDriverToProcessing = (driverId: string) => {
        if (!driverId) return;

        setSelectedDrivers(prev => (prev.includes(driverId) ? prev : [...prev, driverId]));
        setRows(prev => {
            const existing = prev.find(row => row.driver_id === driverId);
            if (existing) return prev;

            const motorista = sortedMotoristas.find(m => m.id === driverId);
            const row: PayrollRow = recalculatePayrollRow({
                driver_id: driverId,
                ordenado_base: motorista?.vencimentoBase || 0,
                horas_extra: 0,
                valor_horas_extra: 0,
                folgas_trabalhadas: 0,
                valor_folgas: 0,
                outros_abonos: 0,
                descontos: 0,
                total_bruto: 0,
                observacoes: ''
            }, 'ordenado_base');

            return [...prev, row];
        });

        setDriverSearch('');
        setShowDriverPicker(false);
    };

    const removeDriverFromProcessing = (driverId: string) => {
        setSelectedDrivers(prev => prev.filter(id => id !== driverId));
        setRows(prev => prev.filter(row => row.driver_id !== driverId));
    };

    const availableDrivers = useMemo(() => {
        const query = driverSearch.trim().toLowerCase();
        return sortedMotoristas
            .filter(m => !selectedDrivers.includes(m.id))
            .filter(m => !query || m.nome.toLowerCase().includes(query));
    }, [driverSearch, selectedDrivers, sortedMotoristas]);

    const visibleRows = useMemo(() => {
        return selectedDrivers
            .map(driverId => rows.find(row => row.driver_id === driverId))
            .filter((row): row is PayrollRow => Boolean(row));
    }, [rows, selectedDrivers]);

    const saveProcessing = async () => {
        if (isPersistenceUnavailable) {
            alert('A tabela de processamento salarial ainda não existe na base de dados. Aplique a migração "20260227_create_driver_payroll_manual.sql" no Supabase para ativar o guardar.');
            return;
        }

        setIsSaving(true);
        const payload = visibleRows
            .filter(r => r.driver_id)
            .map(r => ({
                driver_id: r.driver_id,
                mes,
                ano,
                ordenado_base: r.ordenado_base || 0,
                horas_extra: r.horas_extra || 0,
                valor_horas_extra: r.valor_horas_extra || 0,
                folgas_trabalhadas: r.folgas_trabalhadas || 0,
                valor_folgas: r.valor_folgas || 0,
                outros_abonos: r.outros_abonos || 0,
                descontos: r.descontos || 0,
                total_bruto: calculateTotal(r),
                observacoes: r.observacoes || ''
            }));

        if (payload.length === 0) {
            alert('Não existem linhas válidas para guardar.');
            setIsSaving(false);
            return;
        }

        const { error } = await supabase
            .from('driver_payroll_manual')
            .upsert(payload, { onConflict: 'driver_id,mes,ano' });

        if (error) {
            console.error('Erro ao guardar processamento:', error);

            if (isMissingPayrollTableError(error)) {
                setIsPersistenceUnavailable(true);
                alert('A tabela de processamento salarial ainda não existe na base de dados. Aplique a migração "20260227_create_driver_payroll_manual.sql" no Supabase para ativar o guardar.');
                setIsSaving(false);
                return;
            }

            alert('Erro ao guardar processamento: ' + error.message);
            setIsSaving(false);
            return;
        }

        setIsPersistenceUnavailable(false);

        alert('Processamento salarial guardado com sucesso.');
        await loadProcessing();
        setIsSaving(false);
    };

    const exportToAccounting = () => {
        const exportData = visibleRows
            .filter(r => r.driver_id)
            .map(r => ({
                Motorista: motoristaById.get(r.driver_id) || 'Sem nome',
                'Ordenado Base': r.ordenado_base,
                'Horas Extra (€)': r.valor_horas_extra,
                'Folgas (€)': r.valor_folgas,
                'Outros Abonos': r.outros_abonos,
                Descontos: r.descontos,
                'Total Bruto': calculateTotal(r)
            }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Processamento');
        XLSX.writeFile(workbook, `Processamento_Salarios_${ano}_${String(mes).padStart(2, '0')}.xlsx`);
    };

    const exportToPdf = () => {
        const exportRows = visibleRows.filter(r => r.driver_id);
        const doc = new jsPDF('l', 'mm', 'a4');
        const monthLabel = MONTHS.find(m => m.value === mes)?.label || String(mes);
        const totalGeral = exportRows.reduce((acc, row) => acc + calculateTotal(row), 0);

        doc.setFontSize(16);
        doc.text('Processamento de Salários', 14, 14);
        doc.setFontSize(10);
        doc.text(`Período: ${monthLabel}/${ano}`, 14, 20);

        autoTable(doc, {
            startY: 26,
            head: [[
                'Motorista',
                'Ordenado Base',
                'Horas Extra (€)',
                'Folgas (€)',
                'Outros Abonos',
                'Descontos',
                'Total Bruto'
            ]],
            body: exportRows.map(r => [
                motoristaById.get(r.driver_id) || 'Sem nome',
                formatCurrency(r.ordenado_base || 0),
                formatCurrency(r.valor_horas_extra || 0),
                formatCurrency(r.valor_folgas || 0),
                formatCurrency(r.outros_abonos || 0),
                formatCurrency(r.descontos || 0),
                formatCurrency(calculateTotal(r))
            ]),
            foot: [[
                'TOTAL GERAL',
                '',
                '',
                '',
                '',
                '',
                formatCurrency(totalGeral)
            ]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            footStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' }
            }
        });

        doc.save(`Processamento_Salarios_${ano}_${String(mes).padStart(2, '0')}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-blue-400" />
                        </span>
                        PROCESSAMENTO DE SALÁRIOS
                    </h1>
                    <p className="text-slate-400 mt-2">Preenchimento manual do resumo salarial para contabilidade.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={mes}
                        onChange={(e) => setMes(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                    >
                        {MONTHS.map(month => (
                            <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                    </select>

                    <input
                        type="number"
                        value={ano}
                        onChange={(e) => setAno(toNumber(e.target.value) || today.getFullYear())}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white w-28"
                    />

                    <button
                        onClick={createNewProcessing}
                        className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white font-semibold hover:bg-slate-700 flex items-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Novo Processamento
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowDriverPicker(prev => !prev)}
                            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-white font-semibold hover:bg-slate-700 flex items-center gap-2"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Adicionar Motorista
                        </button>

                        {showDriverPicker && (
                            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-20">
                                <div className="p-3 border-b border-slate-800">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={driverSearch}
                                            onChange={(e) => setDriverSearch(e.target.value)}
                                            placeholder="Pesquisar motorista..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-auto p-2">
                                    {availableDrivers.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-slate-500">Sem motoristas disponíveis.</div>
                                    ) : (
                                        availableDrivers.map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => addDriverToProcessing(m.id)}
                                                className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800"
                                            >
                                                {m.nome}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={saveProcessing}
                        disabled={isSaving || isLoading || isPersistenceUnavailable}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-60 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Guardar
                    </button>

                    <button
                        onClick={exportToAccounting}
                        disabled={visibleRows.length === 0}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-60 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel
                    </button>

                    <button
                        onClick={exportToPdf}
                        disabled={visibleRows.length === 0}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Exportar PDF
                    </button>
                </div>
            </div>

            {isPersistenceUnavailable && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Processamento em modo local: a tabela de persistência ainda não existe no Supabase. Execute a migração
                    {' '}"20260227_create_driver_payroll_manual.sql" para ativar o guardar.
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
                <table className="w-full min-w-[1700px] text-sm">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wide">
                        <tr>
                            <th className="p-3 text-left">Motorista</th>
                            <th className="p-3 text-right">Ordenado Base (€)</th>
                            <th className="p-3 text-right">Horas Extra</th>
                            <th className="p-3 text-right">Valor Horas Extra (€)</th>
                            <th className="p-3 text-right">Folgas Trabalhadas</th>
                            <th className="p-3 text-right">Valor Folgas (€)</th>
                            <th className="p-3 text-right">Outros Abonos (€)</th>
                            <th className="p-3 text-right">Descontos (€)</th>
                            <th className="p-3 text-right">Total Bruto (€)</th>
                            <th className="p-3 text-left">Observações</th>
                            <th className="p-3 text-center">Remover</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td className="p-6 text-center text-slate-500" colSpan={10}>A carregar processamento...</td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td className="p-6 text-center text-slate-500" colSpan={11}>Sem linhas. Clique em "Adicionar Motorista".</td>
                            </tr>
                        ) : visibleRows.map((row) => {
                            const rowIndex = rows.findIndex(r => r.driver_id === row.driver_id);

                            return (
                            <tr key={row.driver_id} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                                <td className="p-2 text-white font-medium">
                                    {motoristaById.get(row.driver_id) || 'Sem nome'}
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.ordenado_base.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { ordenado_base: toNumber(e.target.value) }, 'ordenado_base')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.horas_extra.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { horas_extra: toNumber(e.target.value) }, 'horas_extra')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.valor_horas_extra.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { valor_horas_extra: toNumber(e.target.value) }, 'valor_horas_extra')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.folgas_trabalhadas.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { folgas_trabalhadas: toNumber(e.target.value) }, 'folgas_trabalhadas')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.valor_folgas.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { valor_folgas: toNumber(e.target.value) }, 'valor_folgas')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.outros_abonos.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { outros_abonos: toNumber(e.target.value) }, 'outros_abonos')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={row.descontos.toFixed(2)}
                                        onChange={(e) => updateRow(rowIndex, { descontos: toNumber(e.target.value) }, 'descontos')}
                                        className="w-full text-right bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                    />
                                </td>

                                <td className="p-2 text-right">
                                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                                        {formatCurrency(row.total_bruto)}
                                    </div>
                                </td>

                                <td className="p-2">
                                    <input
                                        type="text"
                                        value={row.observacoes}
                                        onChange={(e) => updateRow(rowIndex, { observacoes: e.target.value }, 'observacoes')}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                                        placeholder="Observações"
                                    />
                                </td>

                                <td className="p-2 text-center">
                                    <button
                                        onClick={() => removeDriverFromProcessing(row.driver_id)}
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                        title="Remover motorista"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
