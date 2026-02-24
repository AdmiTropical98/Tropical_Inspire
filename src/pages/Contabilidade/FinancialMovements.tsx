import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useFinancial } from '../../contexts/FinancialContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { FinancialMovement } from '../../types';
import { formatCurrency } from '../../utils/format';

type MovementPreset = 'all' | 'this_month_expenses' | 'revenue_only' | 'fuel_by_cost_center';

const ACCOUNT_LABELS: Record<FinancialMovement['account_code'], string> = {
    '61': 'Fuel',
    '62': 'Maintenance',
    '63': 'Tolls',
    '64': 'General Expenses',
    '71': 'Revenue'
};

const DOC_LABELS: Record<string, string> = {
    supplier_invoice: 'Supplier Invoice',
    fuel_record: 'Fuel Record',
    toll_expense: 'Toll Expense',
    requisition: 'Requisition',
    fixed_expense: 'Fixed Expense',
    revenue_invoice: 'Revenue Invoice'
};

export default function FinancialMovements() {
    const { financialMovements } = useFinancial();
    const { centrosCustos, viaturas } = useWorkshop();
    const [search, setSearch] = useState('');
    const [accountFilter, setAccountFilter] = useState<'all' | FinancialMovement['account_code']>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | FinancialMovement['type']>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [activePreset, setActivePreset] = useState<MovementPreset>('all');

    const applyPreset = (preset: MovementPreset) => {
        setActivePreset(preset);

        if (preset === 'all') {
            setAccountFilter('all');
            setTypeFilter('all');
            setDateFrom('');
            setDateTo('');
            setSearch('');
            return;
        }

        if (preset === 'this_month_expenses') {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

            setAccountFilter('all');
            setTypeFilter('expense');
            setDateFrom(start);
            setDateTo(end);
            setSearch('');
            return;
        }

        if (preset === 'revenue_only') {
            setAccountFilter('71');
            setTypeFilter('revenue');
            setDateFrom('');
            setDateTo('');
            setSearch('');
            return;
        }

        setAccountFilter('61');
        setTypeFilter('expense');
        setDateFrom('');
        setDateTo('');
        setSearch('');
    };

    const filteredMovements = useMemo(() => {
        const query = search.trim().toLowerCase();
        return financialMovements.filter(movement => {
            const matchesAccount = accountFilter === 'all' || movement.account_code === accountFilter;
            const matchesType = typeFilter === 'all' || movement.type === typeFilter;
            const matchesDateFrom = !dateFrom || movement.date >= dateFrom;
            const matchesDateTo = !dateTo || movement.date <= dateTo;

            const account = ACCOUNT_LABELS[movement.account_code] || movement.account_code;
            const document = DOC_LABELS[movement.document_type] || movement.document_type;
            const matchesSearch = !query || [
                movement.description,
                movement.document_id,
                movement.document_type,
                account,
                document
            ].some(value => String(value || '').toLowerCase().includes(query));

            return matchesAccount && matchesType && matchesDateFrom && matchesDateTo && matchesSearch;
        });
    }, [financialMovements, search, accountFilter, typeFilter, dateFrom, dateTo]);

    const resolveCostCenter = (costCenterId?: string) => {
        if (!costCenterId) return '—';
        const cc = centrosCustos.find(item => item.id === costCenterId);
        return cc?.nome || costCenterId;
    };

    const resolveVehicle = (vehicleId?: string) => {
        if (!vehicleId) return '—';
        const vehicle = viaturas.find(item => item.id === vehicleId);
        return vehicle?.matricula || vehicleId;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Financial Movements</h1>
                    <p className="text-slate-400">Chronological ERP-style ledger generated from operational documents</p>
                </div>
                <div className="text-sm text-slate-400 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {filteredMovements.length} movements
                </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                <div className="flex flex-wrap gap-2 mb-3">
                    <button
                        onClick={() => applyPreset('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activePreset === 'all' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'}`}
                    >
                        All Movements
                    </button>
                    <button
                        onClick={() => applyPreset('this_month_expenses')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activePreset === 'this_month_expenses' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'}`}
                    >
                        This Month Expenses
                    </button>
                    <button
                        onClick={() => applyPreset('revenue_only')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activePreset === 'revenue_only' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'}`}
                    >
                        Revenue Only
                    </button>
                    <button
                        onClick={() => applyPreset('fuel_by_cost_center')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activePreset === 'fuel_by_cost_center' ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-300 border-slate-600 hover:bg-slate-800'}`}
                    >
                        Fuel by Cost Center
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative lg:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search movement, document, account..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value as 'all' | FinancialMovement['account_code'])}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Accounts</option>
                        <option value="61">61 Fuel</option>
                        <option value="62">62 Maintenance</option>
                        <option value="63">63 Tolls</option>
                        <option value="64">64 General Expenses</option>
                        <option value="71">71 Revenue</option>
                    </select>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as 'all' | FinancialMovement['type'])}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Types</option>
                        <option value="expense">Expense</option>
                        <option value="revenue">Revenue</option>
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Document</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Account</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cost Center</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Vehicle</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredMovements.map(movement => (
                                <tr key={movement.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-3 text-sm text-slate-300">{new Date(movement.date).toLocaleDateString('pt-PT')}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        <div className="font-medium text-slate-200">{DOC_LABELS[movement.document_type] || movement.document_type}</div>
                                        <div className="text-xs text-slate-500">{movement.document_id}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-200">{movement.description}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {movement.account_code} - {ACCOUNT_LABELS[movement.account_code] || movement.account_code}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{resolveCostCenter(movement.cost_center_id)}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{resolveVehicle(movement.vehicle_id)}</td>
                                    <td className={`px-4 py-3 text-sm text-right font-semibold ${movement.type === 'revenue' ? 'text-emerald-400' : 'text-red-300'}`}>
                                        {movement.type === 'revenue' ? '+' : '-'} {formatCurrency(Number(movement.amount || 0))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
