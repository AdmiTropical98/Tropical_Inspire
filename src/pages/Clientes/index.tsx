import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, MapPin, BarChart3, ClipboardList, Car } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWorkshop } from '../../contexts/WorkshopContext';
import type { Cliente } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { supabase } from '../../lib/supabase';

interface ClientMonthlyExpense {
    month: string;
    total: number;
}

interface ClientRequisitionRow {
    id: string;
    numero: string;
    data: string;
    tipo: string;
    custo: number | null;
    approved_value: number | null;
    status: string | null;
    obs: string | null;
    viatura_id: string | null;
}

interface ClientVehicleRow {
    id: string;
    matricula: string;
    marca: string;
    modelo: string;
}

export default function Clientes() {
    const { clientes, addCliente, updateCliente, deleteCliente } = useWorkshop();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [monthlyExpenses, setMonthlyExpenses] = useState<ClientMonthlyExpense[]>([]);
    const [clientRequisitions, setClientRequisitions] = useState<ClientRequisitionRow[]>([]);
    const [associatedVehicles, setAssociatedVehicles] = useState<ClientVehicleRow[]>([]);

    // Form State
    const [formData, setFormData] = useState<Partial<Cliente>>({
        nome: '',
        nif: '',
        email: '',
        telefone: '',
        morada: ''
    });

    const filteredClientes = clientes.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nif.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatMoney = (value: number) => new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value || 0);

    useEffect(() => {
        if (clientes.length === 0) {
            setSelectedClientId('');
            return;
        }

        if (!clientes.some(c => c.id === selectedClientId)) {
            setSelectedClientId(clientes[0].id);
        }
    }, [clientes, selectedClientId]);

    useEffect(() => {
        const loadDashboard = async () => {
            if (!selectedClientId) {
                setTotalExpenses(0);
                setMonthlyExpenses([]);
                setClientRequisitions([]);
                setAssociatedVehicles([]);
                return;
            }

            setDashboardLoading(true);
            try {
                const { data: totalData, error: totalError } = await supabase
                    .rpc('get_client_requisition_total_expense', { p_cliente_id: selectedClientId });
                if (totalError) throw totalError;
                setTotalExpenses(Number(totalData || 0));

                const { data: monthlyData, error: monthlyError } = await supabase
                    .rpc('get_client_requisition_monthly_expenses', { p_cliente_id: selectedClientId });
                if (monthlyError) throw monthlyError;

                const formattedMonthly = ((monthlyData || []) as { month_key: string; total: number }[]).map(row => {
                    const monthLabel = row.month_key
                        ? new Date(`${row.month_key}-01T00:00:00`).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
                        : 'N/A';
                    return {
                        month: monthLabel,
                        total: Number(row.total || 0)
                    };
                });
                setMonthlyExpenses(formattedMonthly);

                const { data: reqData, error: reqError } = await supabase
                    .from('requisicoes')
                    .select('id, numero, data, tipo, custo, approved_value, status, obs, viatura_id')
                    .eq('cliente_id', selectedClientId)
                    .order('data', { ascending: false });
                if (reqError) throw reqError;

                const requisitions = (reqData || []) as ClientRequisitionRow[];
                setClientRequisitions(requisitions);

                const vehicleIds = [...new Set(requisitions.map(r => r.viatura_id).filter(Boolean))] as string[];
                if (vehicleIds.length === 0) {
                    setAssociatedVehicles([]);
                } else {
                    const { data: vehicleData, error: vehicleError } = await supabase
                        .from('viaturas')
                        .select('id, matricula, marca, modelo')
                        .in('id', vehicleIds);
                    if (vehicleError) throw vehicleError;
                    setAssociatedVehicles((vehicleData || []) as ClientVehicleRow[]);
                }
            } catch (error) {
                console.error('Erro ao carregar dashboard de cliente:', error);
                setTotalExpenses(0);
                setMonthlyExpenses([]);
                setClientRequisitions([]);
                setAssociatedVehicles([]);
            } finally {
                setDashboardLoading(false);
            }
        };

        void loadDashboard();
    }, [selectedClientId]);

    const handleEdit = (cliente: Cliente) => {
        setEditingCliente(cliente);
        setFormData(cliente);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        if (confirm(t('clients.delete_confirm'))) {
            deleteCliente(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nome || !formData.nif) {
            alert(t('clients.required_fields'));
            return;
        }

        if (editingCliente) {
            updateCliente({ ...editingCliente, ...formData } as Cliente);
        } else {
            addCliente({
                id: crypto.randomUUID(),
                ...formData
            } as Cliente);
        }

        setShowModal(false);
        setEditingCliente(null);
        setFormData({ nome: '', nif: '', email: '', telefone: '', morada: '' });
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={t('clients.search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500"
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingCliente(null);
                        setFormData({ nome: '', nif: '', email: '', telefone: '', morada: '' });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                >
                    <Plus className="w-5 h-5" />
                    {t('clients.new')}
                </button>
            </div>

            <div className="bg-[#1e293b]/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Dashboard de Custos por Cliente</h3>
                        <p className="text-sm text-slate-400">Acompanhe despesas de requisições por cliente.</p>
                    </div>
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full md:w-80 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
                    >
                        {clientes.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Total de Despesas</p>
                        <p className="text-2xl font-black text-emerald-400 mt-2">{dashboardLoading ? '...' : formatMoney(totalExpenses)}</p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Requisições Ligadas</p>
                        <p className="text-2xl font-black text-blue-400 mt-2">{dashboardLoading ? '...' : clientRequisitions.length}</p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Viaturas Associadas</p>
                        <p className="text-2xl font-black text-amber-400 mt-2">{dashboardLoading ? '...' : associatedVehicles.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4 text-slate-200">
                            <BarChart3 className="w-4 h-4 text-blue-400" />
                            <span className="font-semibold">Despesas por Mês</span>
                        </div>
                        <div className="h-64">
                            {monthlyExpenses.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyExpenses}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="month" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem' }}
                                            formatter={(value: number) => [formatMoney(value), 'Total']}
                                        />
                                        <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">Sem dados mensais para este cliente.</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4 text-slate-200">
                            <Car className="w-4 h-4 text-amber-400" />
                            <span className="font-semibold">Viaturas Associadas</span>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                            {associatedVehicles.length > 0 ? associatedVehicles.map(v => (
                                <div key={v.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                                    <p className="text-sm font-semibold text-white">{v.matricula}</p>
                                    <p className="text-xs text-slate-400">{v.marca} {v.modelo}</p>
                                </div>
                            )) : (
                                <p className="text-slate-500 text-sm">Sem viaturas associadas.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4 text-slate-200">
                        <ClipboardList className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold">Requisições do Cliente</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-400 border-b border-slate-800">
                                    <th className="py-2 pr-3">Número</th>
                                    <th className="py-2 pr-3">Data</th>
                                    <th className="py-2 pr-3">Tipo</th>
                                    <th className="py-2 pr-3">Estado</th>
                                    <th className="py-2 pr-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientRequisitions.slice(0, 10).map(req => {
                                    const val = Number(req.custo ?? req.approved_value ?? 0);
                                    return (
                                        <tr key={req.id} className="border-b border-slate-800/60 text-slate-200">
                                            <td className="py-2 pr-3 font-mono">{req.numero}</td>
                                            <td className="py-2 pr-3">{new Date(req.data).toLocaleDateString('pt-PT')}</td>
                                            <td className="py-2 pr-3">{req.tipo || '-'}</td>
                                            <td className="py-2 pr-3">{req.status || '-'}</td>
                                            <td className="py-2 pr-3 text-right font-semibold">{formatMoney(val)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {clientRequisitions.length === 0 && (
                            <p className="text-slate-500 text-sm py-3">Nenhuma requisição associada a este cliente.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientes.map(cliente => (
                    <div key={cliente.id} className="bg-[#1e293b]/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-900/10 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                    <Building2 className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white leading-tight">{cliente.nome}</h3>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">NIF: {cliente.nif}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(cliente)}
                                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(cliente.id)}
                                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400">
                            {cliente.email && (
                                <div className="flex items-center gap-2 truncate">
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    {cliente.email}
                                </div>
                            )}
                            {cliente.telefone && (
                                <div className="flex items-center gap-2 truncate">
                                    <Phone className="w-4 h-4 text-slate-500" />
                                    {cliente.telefone}
                                </div>
                            )}
                            {cliente.morada && (
                                <div className="flex items-center gap-2 truncate">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                    {cliente.morada}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700/60">
                            <Link
                                to={`/clientes/${cliente.id}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                            >
                                Ver perfil financeiro
                            </Link>
                        </div>
                    </div>
                ))}

                {filteredClientes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{t('clients.empty')}</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">
                                {editingCliente ? t('clients.edit') : t('clients.new')}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <span className="sr-only">Fechar</span>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Nome da Empresa / Particular *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.nome || ''}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: Transportes Lda"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">NIF *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.nif || ''}
                                    onChange={e => setFormData({ ...formData, nif: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: 500123456"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.telefone || ''}
                                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="923..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Morada</label>
                                <textarea
                                    value={formData.morada || ''}
                                    onChange={e => setFormData({ ...formData, morada: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 resize-none h-20"
                                    placeholder="Endereço completo..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
