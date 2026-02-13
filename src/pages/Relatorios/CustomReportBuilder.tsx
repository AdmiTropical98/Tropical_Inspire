import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Download, FileSpreadsheet, Search, Filter, Plus, Trash2,
    Table as TableIcon, CheckSquare, ChevronRight, ChevronDown,
    Calendar, RefreshCw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// --- Types ---

type TableOption = {
    value: string;
    label: string;
    columns: { key: string; label: string; type: 'string' | 'number' | 'date' | 'boolean' }[];
};

type FilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'ilike' | 'is';

interface FilterCondition {
    id: string;
    column: string;
    operator: FilterOperator;
    value: string;
}

// --- Schema Metadata ---
// mapping Supabase tables to user-friendly options
const SCHEMA: TableOption[] = [
    {
        value: 'motoristas',
        label: 'Motoristas',
        columns: [
            { key: 'nome', label: 'Nome', type: 'string' },
            { key: 'email', label: 'Email', type: 'string' },
            { key: 'telemovel', label: 'Telemóvel', type: 'string' },
            { key: 'status', label: 'Estado', type: 'string' },
            { key: 'nif', label: 'NIF', type: 'string' },
            { key: 'data_nascimento', label: 'Data Nascimento', type: 'date' },
        ]
    },
    {
        value: 'viaturas',
        label: 'Viaturas',
        columns: [
            { key: 'matricula', label: 'Matrícula', type: 'string' },
            { key: 'marca', label: 'Marca', type: 'string' },
            { key: 'modelo', label: 'Modelo', type: 'string' },
            { key: 'ano', label: 'Ano', type: 'number' },
            { key: 'estado', label: 'Estado', type: 'string' },
            { key: 'kms_atuais', label: 'KMs Atuais', type: 'number' },
        ]
    },
    {
        value: 'fuel_transactions',
        label: 'Abastecimentos',
        columns: [
            { key: 'timestamp', label: 'Data/Hora', type: 'date' },
            { key: 'liters', label: 'Litros', type: 'number' },
            { key: 'price_per_liter', label: 'Preço/L', type: 'number' },
            { key: 'total_cost', label: 'Custo Total', type: 'number' },
            { key: 'km', label: 'KM', type: 'number' },
            { key: 'station', label: 'Posto', type: 'string' },
            // Note: relations like vehicle_id would typically need a join, 
            // for now we stick to raw fields or flattened views if available.
        ]
    },
    {
        value: 'servicos',
        label: 'Serviços / Viagens',
        columns: [
            { key: 'data', label: 'Data', type: 'date' },
            { key: 'hora', label: 'Hora', type: 'string' },
            { key: 'origem', label: 'Origem', type: 'string' },
            { key: 'destino', label: 'Destino', type: 'string' },
            { key: 'passageiro', label: 'Passageiro', type: 'string' },
            { key: 'status', label: 'Estado', type: 'string' },
            { key: 'concluido', label: 'Concluído', type: 'boolean' },
        ]
    },
    {
        value: 'faturas',
        label: 'Faturas Financeiras',
        columns: [
            { key: 'numero', label: 'Número Fatura', type: 'string' },
            { key: 'data', label: 'Data Emissão', type: 'date' },
            { key: 'vencimento', label: 'Vencimento', type: 'date' },
            { key: 'total', label: 'Valor Total', type: 'number' },
            { key: 'status', label: 'Status', type: 'string' },
            { key: 'tipo', label: 'Tipo', type: 'string' },
        ]
    }
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
    { value: 'eq', label: 'Igual a' },
    { value: 'neq', label: 'Diferente de' },
    { value: 'ilike', label: 'Contém (Texto)' },
    { value: 'gt', label: 'Maior que' },
    { value: 'lt', label: 'Menor que' },
    { value: 'gte', label: 'Maior ou Igual' },
    { value: 'lte', label: 'Menor ou Igual' },
];

export default function CustomReportBuilder() {
    // --- State ---
    const [selectedTable, setSelectedTable] = useState<string>(SCHEMA[0].value);
    const [selectedColumns, setSelectedColumns] = useState<string[]>(SCHEMA[0].columns.map(c => c.key));
    const [filters, setFilters] = useState<FilterCondition[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    // Get current table definition
    const currentTableDef = SCHEMA.find(t => t.value === selectedTable)!;

    // --- Actions ---

    const handleTableChange = (table: string) => {
        setSelectedTable(table);
        const def = SCHEMA.find(t => t.value === table);
        if (def) {
            // Default select all columns on table switch
            setSelectedColumns(def.columns.map(c => c.key));
            // Clear filters as they might not apply
            setFilters([]);
            setData([]);
        }
    };

    const toggleColumn = (key: string) => {
        setSelectedColumns(prev =>
            prev.includes(key)
                ? prev.filter(c => c !== key)
                : [...prev, key]
        );
    };

    const addFilter = () => {
        setFilters([...filters, {
            id: Math.random().toString(36).substr(2, 9),
            column: currentTableDef.columns[0].key,
            operator: 'eq',
            value: ''
        }]);
    };

    const removeFilter = (id: string) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id: string, field: keyof FilterCondition, val: string) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [field]: val } : f));
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase.from(selectedTable).select(selectedColumns.join(','));

            // Apply Filters
            filters.forEach(filter => {
                if (!filter.value) return; // Skip empty filters

                switch (filter.operator) {
                    case 'eq': query = query.eq(filter.column, filter.value); break;
                    case 'neq': query = query.neq(filter.column, filter.value); break;
                    case 'gt': query = query.gt(filter.column, filter.value); break;
                    case 'lt': query = query.lt(filter.column, filter.value); break;
                    case 'gte': query = query.gte(filter.column, filter.value); break;
                    case 'lte': query = query.lte(filter.column, filter.value); break;
                    case 'ilike': query = query.ilike(filter.column, `%${filter.value}%`); break;
                    case 'is':
                        if (filter.value === 'null') query = query.is(filter.column, null);
                        break;
                }
            });

            // Default limit to prevent browser crash on massive tables
            query = query.limit(500);

            const { data: resData, error } = await query;

            if (error) {
                console.error("Query Error:", error);
                alert(`Erro na query: ${error.message}`);
                return;
            }

            setData(resData || []);
        } catch (err) {
            console.error(err);
            alert("Ocorreu um erro ao buscar os dados.");
        } finally {
            setLoading(false);
        }
    };

    // --- Exports ---

    const exportPDF = () => {
        if (!data.length) return;
        const doc = new jsPDF('l', 'mm', 'a4');

        doc.setFontSize(14);
        doc.text(`Relatório Personalizado: ${currentTableDef.label}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

        // Map column keys to labels for header
        const headers = selectedColumns.map(key => {
            const col = currentTableDef.columns.find(c => c.key === key);
            return col ? col.label : key;
        });

        const rows = data.map(item => selectedColumns.map(key => {
            const val = item[key];
            if (val === true) return 'Sim';
            if (val === false) return 'Não';
            return val ?? '';
        }));

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 8 },
        });

        doc.save(`relatorio_${selectedTable}.pdf`);
    };

    const exportExcel = () => {
        if (!data.length) return;

        // Map keys to labels for the excel sheet
        const exportData = data.map(item => {
            const row: any = {};
            selectedColumns.forEach(key => {
                const col = currentTableDef.columns.find(c => c.key === key);
                const label = col ? col.label : key;
                row[label] = item[key];
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, `relatorio_${selectedTable}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">

            {/* BUILDER PANEL */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6 text-white">
                    <Search className="w-5 h-5 text-blue-400" />
                    <h2 className="text-xl font-bold">Construtor de Consultas</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* 1. Source Selection */}
                    <div className="md:col-span-3 space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Origem dos Dados</label>
                        <div className="relative">
                            <select
                                value={selectedTable}
                                onChange={(e) => handleTableChange(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                            >
                                {SCHEMA.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Column Selector Toggle */}
                        <button
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className="w-full mt-2 flex items-center justify-between px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-600/50"
                        >
                            <div className="flex items-center gap-2">
                                <TableIcon className="w-4 h-4" />
                                <span>Colunas ({selectedColumns.length})</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-transform ${showColumnSelector ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Dropdown Columns */}
                        {showColumnSelector && (
                            <div className="mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {currentTableDef.columns.map(col => (
                                    <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded cursor-pointer group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedColumns.includes(col.key) ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-transparent group-hover:border-slate-500'}`}>
                                            {selectedColumns.includes(col.key) && <CheckSquare className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className={`text-sm ${selectedColumns.includes(col.key) ? 'text-white' : 'text-slate-400'}`}>{col.label}</span>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedColumns.includes(col.key)}
                                            onChange={() => toggleColumn(col.key)}
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 2. Filters */}
                    <div className="md:col-span-9 space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtros Ativos</label>
                            <button onClick={addFilter} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                <Plus className="w-3 h-3" /> Adicionar Filtro
                            </button>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 min-h-[120px] space-y-3">
                            {filters.length === 0 ? (
                                <div className="text-center text-slate-500 py-4 flex flex-col items-center gap-2">
                                    <Filter className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">Nenhum filtro aplicado. Todos os registos serão mostrados.</span>
                                </div>
                            ) : (
                                filters.map((filter) => (
                                    <div key={filter.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center animate-fade-in">
                                        {/* Column */}
                                        <select
                                            value={filter.column}
                                            onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                                            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                        >
                                            {currentTableDef.columns.map(c => (
                                                <option key={c.key} value={c.key}>{c.label}</option>
                                            ))}
                                        </select>

                                        {/* Operator */}
                                        <select
                                            value={filter.operator}
                                            onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                                            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                        >
                                            {OPERATORS.map(op => (
                                                <option key={op.value} value={op.value}>{op.label}</option>
                                            ))}
                                        </select>

                                        {/* Value */}
                                        <input
                                            type={filter.column.includes('data') || filter.column.includes('timestamp') ? 'date' : 'text'}
                                            value={filter.value}
                                            onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                            placeholder="Valor..."
                                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                        />

                                        {/* Actions */}
                                        <button
                                            onClick={() => removeFilter(filter.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Generate Action */}
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={fetchData}
                        disabled={loading || selectedColumns.length === 0}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        {loading ? 'A processar...' : 'Executar Consulta'}
                    </button>
                </div>
            </div>

            {/* RESULTS PANEL */}
            {data.length > 0 && (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-slate-400">
                            <span className="font-mono text-white font-bold">{data.length}</span>
                            <span className="text-sm">resultados encontrados</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={exportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
                            >
                                <Download className="w-4 h-4" /> PDF
                            </button>
                            <button
                                onClick={exportExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg text-sm transition-colors"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-900/90 text-xs uppercase font-medium text-slate-400 sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        {selectedColumns.map(colKey => {
                                            const colDef = currentTableDef.columns.find(c => c.key === colKey);
                                            return (
                                                <th key={colKey} className="px-6 py-4 whitespace-nowrap font-semibold border-b border-slate-700/50">
                                                    {colDef?.label || colKey}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                            {selectedColumns.map(colKey => {
                                                const val = row[colKey];
                                                // Formatting
                                                let displayVal = val;
                                                if (val === true) displayVal = <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded textxs">Sim</span>;
                                                else if (val === false) displayVal = <span className="text-slate-500">Não</span>;
                                                else if (colKey.includes('data') || colKey.includes('timestamp')) {
                                                    displayVal = val ? new Date(val).toLocaleDateString() : '-';
                                                }

                                                return (
                                                    <td key={colKey} className="px-6 py-3 whitespace-nowrap border-b border-slate-800/50">
                                                        {displayVal ?? '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
