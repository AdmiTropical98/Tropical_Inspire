import { useState } from 'react'; // v2

import { supabase } from '../../lib/supabase';
import {
    Download, FileSpreadsheet, Search, Filter, Plus, Trash2,
    Table as TableIcon, CheckSquare, ChevronRight, ChevronDown,
    RefreshCw, X
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// --- Types ---

type ColumnDefinition = {
    key: string;       // The key to access data in the flat row
    label: string;     // User facing label
    type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
    select: string;    // The actual SQL select string (e.g. "matricula", "viaturas(matricula)")
};

type TableOption = {
    value: string;
    label: string;
    columns: ColumnDefinition[];
};

type FilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'ilike' | 'is';

interface FilterCondition {
    id: string;
    column: string;
    operator: FilterOperator;
    value: string;
}

// --- Schema Metadata ---
// mapping Supabase tables to user-friendly options with RELATIONS
const SCHEMA: TableOption[] = [
    {
        value: 'viaturas',
        label: 'Viaturas (Principal)',
        columns: [
            { key: 'matricula', label: 'Matrícula', type: 'string', select: 'matricula' },
            { key: 'marca', label: 'Marca', type: 'string', select: 'marca' },
            { key: 'modelo', label: 'Modelo', type: 'string', select: 'modelo' },
            { key: 'ano', label: 'Ano', type: 'number', select: 'ano' },
            { key: 'kms_atuais', label: 'KMs Atuais', type: 'number', select: 'kms_atuais' },
            { key: 'status', label: 'Estado', type: 'string', select: 'status' },
        ]
    },
    {
        value: 'motoristas',
        label: 'Motoristas',
        columns: [
            { key: 'nome', label: 'Nome', type: 'string', select: 'nome' },
            { key: 'email', label: 'Email', type: 'string', select: 'email' },
            { key: 'telemovel', label: 'Telemóvel', type: 'string', select: 'telemovel' },
            { key: 'status', label: 'Estado', type: 'string', select: 'status' },
            { key: 'nif', label: 'NIF', type: 'string', select: 'nif' },
        ]
    },
    {
        value: 'fuel_transactions',
        label: 'Abastecimentos',
        columns: [
            { key: 'timestamp', label: 'Data', type: 'date', select: 'timestamp' },
            { key: 'liters', label: 'Litros', type: 'number', select: 'liters' },
            { key: 'total_cost', label: 'Custo Total', type: 'currency', select: 'total_cost' },
            { key: 'km', label: 'KM Registo', type: 'number', select: 'km' },
            { key: 'station', label: 'Posto', type: 'string', select: 'station' },
            // Joins
            { key: 'viaturas.matricula', label: 'Viatura (Matrícula)', type: 'string', select: 'viaturas(matricula)' },
            { key: 'motoristas.nome', label: 'Motorista (Nome)', type: 'string', select: 'motoristas(nome)' },
        ]
    },
    {
        value: 'requisicoes',
        label: 'Requisições',
        columns: [
            { key: 'numero', label: 'Número Req.', type: 'string', select: 'numero' },
            { key: 'data', label: 'Data', type: 'date', select: 'data' },
            { key: 'urgente', label: 'Urgente', type: 'boolean', select: 'urgente' },
            { key: 'status', label: 'Estado', type: 'string', select: 'status' },
            { key: 'obs', label: 'Observações', type: 'string', select: 'obs' },
            // Joins
            { key: 'viaturas.matricula', label: 'Viatura (Matrícula)', type: 'string', select: 'viaturas(matricula)' },
            { key: 'fornecedores.nome', label: 'Fornecedor', type: 'string', select: 'fornecedores(nome)' },
        ]
    },
    {
        value: 'manutencoes',
        label: 'Manutenções',
        columns: [
            { key: 'data', label: 'Data', type: 'date', select: 'data' },
            { key: 'tipo', label: 'Tipo', type: 'string', select: 'tipo' },
            { key: 'descricao', label: 'Descrição', type: 'string', select: 'descricao' },
            { key: 'oficina', label: 'Oficina', type: 'string', select: 'oficina' },
            { key: 'custo', label: 'Custo', type: 'currency', select: 'custo' },
            { key: 'km', label: 'KM', type: 'number', select: 'km' },
            // Joins
            { key: 'viaturas.matricula', label: 'Viatura (Matrícula)', type: 'string', select: 'viaturas(matricula)' },
        ]
    },
    {
        value: 'servicos',
        label: 'Serviços / Viagens',
        columns: [
            { key: 'data', label: 'Data', type: 'date', select: 'data' },
            { key: 'hora', label: 'Hora', type: 'string', select: 'hora' },
            { key: 'origem', label: 'Origem', type: 'string', select: 'origem' },
            { key: 'destino', label: 'Destino', type: 'string', select: 'destino' },
            { key: 'passageiro', label: 'Passageiro', type: 'string', select: 'passageiro' },
            { key: 'concluido', label: 'Concluído', type: 'boolean', select: 'concluido' },
            // Joins
            { key: 'viaturas.matricula', label: 'Viatura', type: 'string', select: 'viaturas(matricula)' },
            { key: 'motoristas.nome', label: 'Motorista', type: 'string', select: 'motoristas(nome)' },
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
    { value: 'is', label: 'É (Nulo/Vazio)' },
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

    // --- Data Fetching Logic with Flattening ---

    const fetchData = async () => {
        setLoading(true);
        try {
            // Build the select string
            // e.g. "timestamp,liters,viaturas(matricula),motoristas(nome)"
            const queryColumns = selectedColumns.map(key => {
                const col = currentTableDef.columns.find(c => c.key === key);
                return col ? col.select : key; // Fallback to key if not found
            });

            // Clean duplicates just in case
            const uniqueSelects = [...new Set(queryColumns)].join(',');

            let query = supabase.from(selectedTable).select(uniqueSelects);

            // Apply Filters (LIMITATION: Filters currently strictly work on top-level columns because Supabase filtering on joined columns is complex via JS sdk without flattening first)
            // Ideally we'd map the filter column back to the 'select' value, but filtering on joined tables (e.g. viaturas.matricula) requires different syntax.
            // For now, we allow filtering on main table columns primarily.
            filters.forEach(filter => {
                if (!filter.value && filter.operator !== 'is') return;

                const colDef = currentTableDef.columns.find(c => c.key === filter.column);
                // If the column is a Relation (contains '('), we skip efficient filtering for now or handle simple cases.
                // Simple workaround: Only filter if it's a direct column (no parentheses)
                let filterColumn = colDef!.select;

                // Se for relação (ex: viaturas(matricula))
                if (colDef!.select.includes('(')) {
                    const match = colDef!.select.match(/(\w+)\((\w+)\)/);
                    if (match) {
                        const [_, table, field] = match;
                        filterColumn = `${table}.${field}`;
                    }
                }

                switch (filter.operator) {
                    case 'eq': query = query.eq(filterColumn, filter.value); break;
                    case 'neq': query = query.neq(filterColumn, filter.value); break;
                    case 'gt': query = query.gt(filterColumn, filter.value); break;
                    case 'lt': query = query.lt(filterColumn, filter.value); break;
                    case 'gte': query = query.gte(filterColumn, filter.value); break;
                    case 'lte': query = query.lte(filterColumn, filter.value); break;
                    case 'ilike': query = query.ilike(filterColumn, `%${filter.value}%`); break;
                    case 'is':
                        if (filter.value === 'null') query = query.is(filterColumn, null);
                        break;
                }

            });

            query = query.limit(500);
            const firstColumn = currentTableDef.columns[0];

            if (firstColumn && !firstColumn.select.includes('(')) {
                query = query.order(firstColumn.select, { ascending: false });
            }

            const { data: resData, error } = await query;

            if (error) {
                console.error("Query Error:", error);
                alert(`Erro na query: ${error.message}`);
                return;
            }

            // FLATTEN DATA
            // Transform { fuel: { liters: 10 }, viaturas: { matricula: 'AA' } } -> { liters: 10, 'viaturas.matricula': 'AA' }
            const flattened = (resData || []).map((row: any) => {
                const flatRow: any = {};
                selectedColumns.forEach(key => {
                    const colDef = currentTableDef.columns.find(c => c.key === key);
                    if (!colDef) return;

                    if (colDef.select.includes('(')) {
                        // It's a join, e.g. viaturas(matricula) -> accessible via row.viaturas.matricula
                        // "viaturas(matricula)" -> table: "viaturas", field: "matricula"
                        const match = colDef.select.match(/(\w+)\((\w+)\)/);
                        if (match) {
                            const [_, table, field] = match;
                            // Safe access
                            const relationData = row[table];
                            if (relationData) {
                                if (Array.isArray(relationData)) {
                                    // One-to-many? Pick first?
                                    flatRow[key] = relationData.map((item: any) => item[field]).join(', ');
                                } else {
                                    flatRow[key] = relationData[field];
                                }
                            } else {
                                flatRow[key] = '-';
                            }
                        } else {
                            flatRow[key] = '-';
                        }
                    } else {
                        // Direct access
                        flatRow[key] = row[colDef.select];
                    }
                });
                return flatRow;
            });

            setData(flattened);
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
        doc.text(`Relatório: ${currentTableDef.label}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

        const headers = selectedColumns.map(key => {
            const col = currentTableDef.columns.find(c => c.key === key);
            return col ? col.label : key;
        });

        const rows = data.map(item => selectedColumns.map(key => {
            let val = item[key];
            const col = currentTableDef.columns.find(c => c.key === key);
            if (col?.type === 'boolean') return val ? 'Sim' : 'Não';
            if (col?.type === 'date' && val) return new Date(val).toLocaleDateString() + ' ' + new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (col?.type === 'currency' && val) return Number(val).toFixed(2) + '€';
            return val ?? '';
        }));

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 8 },
        });

        doc.save(`relatorio_${selectedTable}.pdf`);
    };
    // --- Totals Calculation ---
    const totals = selectedColumns.reduce((acc: any, colKey) => {
        const colDef = currentTableDef.columns.find(c => c.key === colKey);
        if (!colDef) return acc;

        if (colDef.type === 'number' || colDef.type === 'currency') {
            acc[colKey] = data.reduce((sum, row) => {
                const value = Number(row[colKey]);
                return sum + (isNaN(value) ? 0 : value);
            }, 0);
        }

        return acc;
    }, {});

    const exportExcel = () => {
        if (!data.length) return;
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
            <div className="bg-slate-100 rounded-xl border border-slate-200/50 p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6 text-slate-900">
                    <Search className="w-5 h-5 text-blue-400" />
                    <h2 className="text-xl font-bold">Construtor de Consultas Avançado</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* 1. Source Selection */}
                    <div className="md:col-span-3 space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Origem dos Dados</label>
                        <div className="relative">
                            <select
                                value={selectedTable}
                                onChange={(e) => handleTableChange(e.target.value)}
                                className="w-full bg-white/90 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
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
                            className="w-full mt-2 flex items-center justify-between px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-300/50"
                        >
                            <div className="flex items-center gap-2">
                                <TableIcon className="w-4 h-4" />
                                <span>Colunas ({selectedColumns.length})</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-transform ${showColumnSelector ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Dropdown Columns */}
                        {showColumnSelector && (
                            <div className="mt-2 bg-white/90 border border-slate-200 rounded-lg p-3 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar shadow-2xl z-20 absolute w-[300px]">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Campos Disponíveis</span>
                                    <button onClick={() => setShowColumnSelector(false)}><X className="w-4 h-4 text-slate-400" /></button>
                                </div>
                                {currentTableDef.columns.map(col => (
                                    <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded cursor-pointer group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedColumns.includes(col.key) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-transparent group-hover:border-slate-500'}`}>
                                            {selectedColumns.includes(col.key) && <CheckSquare className="w-3 h-3 text-slate-900" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-sm ${selectedColumns.includes(col.key) ? 'text-white' : 'text-slate-400'}`}>{col.label}</span>
                                            {col.select.includes('(') && <span className="text-[10px] text-blue-400">Relação</span>}
                                        </div>
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

                        <div className="bg-white/90 border border-slate-200/50 rounded-lg p-4 min-h-[120px] space-y-3">
                            {filters.length === 0 ? (
                                <div className="text-center text-slate-500 py-4 flex flex-col items-center gap-2">
                                    <Filter className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">Nenhum filtro aplicado. Todos os registos serão mostrados.</span>
                                </div>
                            ) : (
                                filters.map((filter) => (
                                    <div key={filter.id} className="flex flex-col md:flex-row gap-2 items-start md:items-center animate-fade-in text-sm">
                                        {/* Column */}
                                        <select
                                            value={filter.column}
                                            onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                                            className="bg-slate-100 border border-slate-300 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                        >
                                            {currentTableDef.columns
                                                .filter(c => !c.select.includes('(')) // Only allow filtering on local columns for now
                                                .map(c => (
                                                    <option key={c.key} value={c.key}>{c.label}</option>
                                                ))}
                                        </select>

                                        {/* Operator */}
                                        <select
                                            value={filter.operator}
                                            onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                                            className="bg-slate-100 border border-slate-300 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                        >
                                            {OPERATORS.map(op => (
                                                <option key={op.value} value={op.value}>{op.label}</option>
                                            ))}
                                        </select>

                                        {/* Value */}
                                        {filter.operator !== 'is' && (
                                            <input
                                                type={filter.column.includes('data') || filter.column.includes('timestamp') ? 'date' : 'text'}
                                                value={filter.value}
                                                onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                                placeholder="Valor..."
                                                className="flex-1 bg-slate-100 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 w-full md:w-auto"
                                            />
                                        )}
                                        {filter.operator === 'is' && (
                                            <div className="flex-1 text-slate-500 italic px-2">
                                                (Vazio / Nulo)
                                            </div>
                                        )}

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
                            <span className="font-mono text-slate-900 font-bold">{data.length}</span>
                            <span className="text-sm">resultados encontrados</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={exportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-200"
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

                    <div className="bg-slate-100 rounded-xl border border-slate-200/50 overflow-x-auto shadow-2xl">
                        <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-white/90/90 text-xs uppercase font-medium text-slate-400 sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        {selectedColumns.map(colKey => {
                                            const colDef = currentTableDef.columns.find(c => c.key === colKey);
                                            return (
                                                <th key={colKey} className="px-6 py-4 whitespace-nowrap font-semibold border-b border-slate-200/50">
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
                                                const col = currentTableDef.columns.find(c => c.key === colKey);

                                                let displayVal = val;
                                                if (col?.type === 'boolean') {
                                                    displayVal = val
                                                        ? <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px] font-bold">SIM</span>
                                                        : <span className="text-slate-500 text-[10px]">NÃO</span>;
                                                } else if (col?.type === 'date' && val) {
                                                    displayVal = new Date(val).toLocaleDateString() + ' ' + new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                } else if (col?.type === 'currency' && val != null) {
                                                    displayVal = <span className="font-mono text-emerald-400">{Number(val).toFixed(2)}€</span>;
                                                }

                                                return (
                                                    <td key={colKey} className="px-6 py-3 whitespace-nowrap border-b border-slate-200/50">
                                                        {displayVal ?? <span className="text-slate-600">-</span>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {/* Totals Row */}
                                    <tr className="bg-white/90/80 font-bold border-t border-slate-300">
                                        {selectedColumns.map(colKey => {
                                            const colDef = currentTableDef.columns.find(c => c.key === colKey);

                                            if (colDef?.type === 'number') {
                                                return (
                                                    <td key={colKey} className="px-6 py-3 text-blue-400">
                                                        {totals[colKey] ?? ''}
                                                    </td>
                                                );
                                            }

                                            if (colDef?.type === 'currency') {
                                                return (
                                                    <td key={colKey} className="px-6 py-3 text-emerald-400 font-mono">
                                                        {totals[colKey] != null ? totals[colKey].toFixed(2) + '€' : ''}
                                                    </td>
                                                );
                                            }

                                            // First column shows label TOTAL
                                            if (colKey === selectedColumns[0]) {
                                                return (
                                                    <td key={colKey} className="px-6 py-3 text-slate-900 uppercase tracking-wide">
                                                        TOTAL
                                                    </td>
                                                );
                                            }

                                            return <td key={colKey}></td>;
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
