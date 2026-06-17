import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, ShieldAlert, ShieldCheck, ShieldX, Plus, Search,
    X, Car, Calendar, Building2, FileText, AlertTriangle, CheckCircle,
    Clock, ChevronRight, Edit2, Save
} from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { supabase } from '../../lib/supabase';
import type { Viatura, Seguro } from '../../types';

const today = () => new Date().toISOString().split('T')[0];

const getInsuranceStatus = (seguro?: Seguro) => {
    if (!seguro?.apolice || !seguro?.validade) return 'missing';
    const exp = new Date(seguro.validade);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'valid';
};

const statusConfig = {
    valid: {
        label: 'Válido',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        icon: ShieldCheck,
    },
    expiring: {
        label: 'A Expirar',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
        icon: ShieldAlert,
    },
    expired: {
        label: 'Expirado',
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        icon: ShieldX,
    },
    missing: {
        label: 'Sem Registo',
        color: 'text-slate-400',
        bg: 'bg-slate-500/10 border-slate-500/20',
        icon: Shield,
    },
};

const daysUntilExpiry = (validade?: string) => {
    if (!validade) return null;
    const diff = Math.ceil((new Date(validade).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
};

const formatDate = (value?: string) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('pt-PT');
    } catch {
        return value;
    }
};

interface InsuranceFormData {
    apolice: string;
    companhia: string;
    validade: string;
    pdfUrl: string;
}

const emptyForm = (): InsuranceFormData => ({
    apolice: '',
    companhia: '',
    validade: '',
    pdfUrl: '',
});

export default function VehicleInsurance() {
    const navigate = useNavigate();
    const { viaturas, updateViatura } = useWorkshop();

    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'list'>('overview');
    const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'expiring' | 'expired' | 'missing'>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<InsuranceFormData>(emptyForm());
    const [saving, setSaving] = useState(false);

    const enriched = useMemo(() =>
        viaturas.map(v => ({
            viatura: v,
            status: getInsuranceStatus(v.seguro),
            days: daysUntilExpiry(v.seguro?.validade),
        })),
        [viaturas]
    );

    const stats = useMemo(() => ({
        total: enriched.length,
        valid: enriched.filter(e => e.status === 'valid').length,
        expiring: enriched.filter(e => e.status === 'expiring').length,
        expired: enriched.filter(e => e.status === 'expired').length,
        missing: enriched.filter(e => e.status === 'missing').length,
    }), [enriched]);

    const filtered = useMemo(() => {
        let result = enriched;
        if (filterStatus !== 'all') result = result.filter(e => e.status === filterStatus);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e =>
                e.viatura.matricula.toLowerCase().includes(q) ||
                e.viatura.marca.toLowerCase().includes(q) ||
                e.viatura.modelo.toLowerCase().includes(q) ||
                (e.viatura.seguro?.companhia || '').toLowerCase().includes(q) ||
                (e.viatura.seguro?.apolice || '').toLowerCase().includes(q)
            );
        }
        return result.sort((a, b) => {
            const order: Record<string, number> = { expired: 0, expiring: 1, missing: 2, valid: 3 };
            return (order[a.status] ?? 99) - (order[b.status] ?? 99);
        });
    }, [enriched, filterStatus, search]);

    const openEdit = (v: Viatura) => {
        setEditingId(v.id);
        setFormData({
            apolice: v.seguro?.apolice || '',
            companhia: v.seguro?.companhia || '',
            validade: v.seguro?.validade || '',
            pdfUrl: v.seguro?.pdfUrl || '',
        });
    };

    const closeEdit = () => {
        setEditingId(null);
        setFormData(emptyForm());
    };

    const handleSave = async (v: Viatura) => {
        setSaving(true);
        try {
            const seguro: Seguro = {
                apolice: formData.apolice.trim(),
                companhia: formData.companhia.trim(),
                validade: formData.validade,
                pdfUrl: formData.pdfUrl.trim() || undefined,
            };

            const updated: Viatura = { ...v, seguro };

            // Persist to Supabase
            await supabase.from('viaturas').update({ seguro }).eq('id', v.id);

            // Update local state
            updateViatura(updated);
            closeEdit();
        } catch (err) {
            console.error('Erro ao guardar seguro:', err);
            alert('Erro ao guardar. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async (v: Viatura) => {
        if (!confirm('Tem a certeza que quer remover o registo de seguro desta viatura?')) return;
        const updated: Viatura = { ...v, seguro: undefined };
        await supabase.from('viaturas').update({ seguro: null }).eq('id', v.id);
        updateViatura(updated);
    };

    const editingVehicle = editingId ? viaturas.find(v => v.id === editingId) : null;

    return (
        <div className="frota-page flex flex-col text-slate-900">
            <div className="frota-page-body space-y-8">

                {/* Header */}
                <div className="frota-page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[#1f2957] tracking-tight mb-2 flex items-center gap-4">
                            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                                Seguros de Viaturas
                            </span>
                            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold border border-blue-200">
                                {stats.total}
                            </span>
                        </h1>
                        <p className="text-slate-500 text-base font-medium">
                            Gestão e controlo dos registos de seguros da frota.
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="frota-segmented-tabs flex items-center gap-2 border-b border-slate-200">
                    {[
                        { id: 'overview', label: 'Resumo', icon: Shield },
                        { id: 'list', label: 'Todas as Viaturas', icon: Car },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all
                            ${activeTab === tab.id
                                    ? 'border-[#d59d31] text-[#1f2957] bg-amber-50/60'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                            {[
                                { label: 'Com seguro válido', value: stats.valid, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', status: 'valid' as const },
                                { label: 'A expirar (≤30 dias)', value: stats.expiring, icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', status: 'expiring' as const },
                                { label: 'Seguro expirado', value: stats.expired, icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', status: 'expired' as const },
                                { label: 'Sem registo', value: stats.missing, icon: Shield, color: 'text-slate-400', bg: 'bg-slate-200/80 border-slate-200', status: 'missing' as const },
                            ].map(card => (
                                <button
                                    key={card.label}
                                    onClick={() => { setFilterStatus(card.status); setActiveTab('list'); }}
                                    className="kpi-card relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${card.bg} border flex items-center justify-center mb-4`}>
                                        <card.icon className={`w-6 h-6 ${card.color}`} />
                                    </div>
                                    <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">{card.label}</h3>
                                    <div className="text-4xl font-black text-slate-900 mt-2">{card.value}</div>
                                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Ver lista <ChevronRight className="w-3 h-3" />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Alerts Section */}
                        {(stats.expired > 0 || stats.expiring > 0) && (
                            <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                                <h2 className="text-lg font-bold text-[#1f2957] mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    Alertas de Seguro
                                </h2>
                                <div className="space-y-3">
                                    {enriched
                                        .filter(e => e.status === 'expired' || e.status === 'expiring')
                                        .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
                                        .map(({ viatura, status, days }) => {
                                            const cfg = statusConfig[status];
                                            const Icon = cfg.icon;
                                            return (
                                                <div key={viatura.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${cfg.bg}`}>
                                                    <div className="flex items-center gap-3">
                                                        <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-900">
                                                                {viatura.marca} {viatura.modelo}
                                                                <span className="ml-2 text-xs font-mono text-slate-400">{viatura.matricula}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {viatura.seguro?.companhia} • Apólice: {viatura.seguro?.apolice || '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className={`text-xs font-bold ${cfg.color}`}>
                                                            {status === 'expired'
                                                                ? `Expirado há ${Math.abs(days ?? 0)} dias`
                                                                : `Expira em ${days} dias`}
                                                        </div>
                                                        <div className="text-xs text-slate-400">{formatDate(viatura.seguro?.validade)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Recent Expirations Table */}
                        <div className="bg-white/90 border border-slate-200 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-[#1f2957]">Próximas Expirações</h2>
                                <button
                                    onClick={() => { setActiveTab('list'); setFilterStatus('all'); }}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                >
                                    Ver todas <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-100 text-xs uppercase tracking-wider">
                                            <th className="text-left py-2 pb-3">Viatura</th>
                                            <th className="text-left py-2 pb-3">Companhia</th>
                                            <th className="text-left py-2 pb-3">Apólice</th>
                                            <th className="text-left py-2 pb-3">Validade</th>
                                            <th className="text-left py-2 pb-3">Estado</th>
                                            <th className="text-left py-2 pb-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enriched
                                            .filter(e => e.status !== 'missing')
                                            .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
                                            .slice(0, 8)
                                            .map(({ viatura, status, days }) => {
                                                const cfg = statusConfig[status];
                                                const Icon = cfg.icon;
                                                return (
                                                    <tr key={viatura.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3">
                                                            <div className="font-bold text-slate-900 text-sm">{viatura.marca} {viatura.modelo}</div>
                                                            <div className="text-xs font-mono text-slate-400">{viatura.matricula}</div>
                                                        </td>
                                                        <td className="py-3 text-slate-700">{viatura.seguro?.companhia || '—'}</td>
                                                        <td className="py-3 font-mono text-slate-700 text-xs">{viatura.seguro?.apolice || '—'}</td>
                                                        <td className="py-3 text-slate-700">{formatDate(viatura.seguro?.validade)}</td>
                                                        <td className="py-3">
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                                                                <Icon className="w-3 h-3" />
                                                                {cfg.label}
                                                                {days !== null && status !== 'missing' && (
                                                                    <span className="opacity-70">
                                                                        {status === 'expired' ? `(${Math.abs(days)}d)` : `(${days}d)`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="py-3">
                                                            <button
                                                                onClick={() => openEdit(viatura)}
                                                                className="text-xs text-blue-500 hover:text-blue-700 font-bold flex items-center gap-1"
                                                            >
                                                                <Edit2 className="w-3 h-3" /> Editar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        {enriched.filter(e => e.status !== 'missing').length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                                                    Nenhum registo de seguro encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* LIST TAB */}
                {activeTab === 'list' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Pesquisar por matrícula, marca, companhia..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {(['all', 'valid', 'expiring', 'expired', 'missing'] as const).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${filterStatus === s
                                            ? 'bg-[#1f2957] text-white border-[#1f2957]'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {s === 'all' ? 'Todos' : statusConfig[s].label}
                                        {s !== 'all' && (
                                            <span className="ml-1 opacity-70">
                                                ({s === 'valid' ? stats.valid : s === 'expiring' ? stats.expiring : s === 'expired' ? stats.expired : stats.missing})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr className="text-slate-400 text-xs uppercase tracking-wider">
                                            <th className="text-left px-6 py-3">Viatura</th>
                                            <th className="text-left px-6 py-3">Companhia</th>
                                            <th className="text-left px-6 py-3">Nº Apólice</th>
                                            <th className="text-left px-6 py-3">Validade</th>
                                            <th className="text-left px-6 py-3">Estado</th>
                                            <th className="text-right px-6 py-3">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.map(({ viatura, status, days }) => {
                                            const cfg = statusConfig[status];
                                            const Icon = cfg.icon;
                                            return (
                                                <tr key={viatura.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                                <Car className="w-4 h-4 text-blue-500" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900">{viatura.marca} {viatura.modelo}</div>
                                                                <div className="text-xs font-mono text-slate-400">{viatura.matricula} • {viatura.ano}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-slate-700">
                                                            {viatura.seguro?.companhia
                                                                ? <><Building2 className="w-3.5 h-3.5 text-slate-400" />{viatura.seguro.companhia}</>
                                                                : <span className="text-slate-300 italic">—</span>
                                                            }
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-slate-700">
                                                            {viatura.seguro?.apolice
                                                                ? <><FileText className="w-3.5 h-3.5 text-slate-400" /><span className="font-mono text-sm">{viatura.seguro.apolice}</span></>
                                                                : <span className="text-slate-300 italic">—</span>
                                                            }
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-slate-700">
                                                            {viatura.seguro?.validade
                                                                ? <><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(viatura.seguro.validade)}</>
                                                                : <span className="text-slate-300 italic">—</span>
                                                            }
                                                        </div>
                                                        {days !== null && status !== 'missing' && (
                                                            <div className={`text-xs mt-0.5 ${cfg.color} font-semibold`}>
                                                                {status === 'expired'
                                                                    ? `Expirado há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}`
                                                                    : `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {viatura.seguro?.pdfUrl && (
                                                                <a
                                                                    href={viatura.seguro.pdfUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                                    title="Ver documento"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => openEdit(viatura)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                                {status === 'missing' ? 'Adicionar' : 'Editar'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-16 text-center">
                                                    <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-slate-400 font-medium">Nenhuma viatura encontrada</p>
                                                    <p className="text-slate-300 text-sm mt-1">Tente ajustar os filtros de pesquisa.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingVehicle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 animate-in slide-in-from-bottom-4 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Seguro da Viatura</h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {editingVehicle.marca} {editingVehicle.modelo}
                                    <span className="ml-2 font-mono text-xs text-slate-400">{editingVehicle.matricula}</span>
                                </p>
                            </div>
                            <button
                                onClick={closeEdit}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Nº Apólice *
                                </label>
                                <input
                                    type="text"
                                    placeholder="ex: AV-2024-0012345"
                                    value={formData.apolice}
                                    onChange={e => setFormData(f => ({ ...f, apolice: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Companhia de Seguros *
                                </label>
                                <input
                                    type="text"
                                    placeholder="ex: Fidelidade, Tranquilidade, Ageas..."
                                    value={formData.companhia}
                                    onChange={e => setFormData(f => ({ ...f, companhia: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Data de Validade *
                                </label>
                                <input
                                    type="date"
                                    value={formData.validade}
                                    min={today()}
                                    onChange={e => setFormData(f => ({ ...f, validade: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Link do Documento (opcional)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={formData.pdfUrl}
                                    onChange={e => setFormData(f => ({ ...f, pdfUrl: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>

                            {/* Preview status */}
                            {formData.validade && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    {(() => {
                                        const previewStatus = getInsuranceStatus({ apolice: formData.apolice, companhia: formData.companhia, validade: formData.validade });
                                        const cfg = statusConfig[previewStatus];
                                        const Icon = cfg.icon;
                                        const d = daysUntilExpiry(formData.validade);
                                        return (
                                            <>
                                                <Icon className={`w-4 h-4 ${cfg.color}`} />
                                                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                                                {d !== null && (
                                                    <span className="text-xs text-slate-400">
                                                        {d < 0 ? `(expirado há ${Math.abs(d)} dias)` : `(${d} dias)`}
                                                    </span>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                            {editingVehicle.seguro?.apolice ? (
                                <button
                                    onClick={() => handleClear(editingVehicle)}
                                    className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors"
                                >
                                    Remover registo
                                </button>
                            ) : <div />}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeEdit}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleSave(editingVehicle)}
                                    disabled={saving || !formData.apolice.trim() || !formData.companhia.trim() || !formData.validade}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl btn-primary text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {saving
                                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A guardar...</>
                                        : <><Save className="w-4 h-4" /> Guardar</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
