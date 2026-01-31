
import { useState, useMemo } from 'react';
import { UserCog, Plus, Trash2, AlertCircle, Shield, Share2, MessageSquare, Search, TrendingUp, Users, UserX, Clock, Grid3x3, List, CheckCircle } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Supervisor, Notification } from '../../types';
import UserPermissionsModal from '../Permissoes/UserPermissionsModal';

export default function Supervisores() {
    const { supervisors, addSupervisor, updateSupervisor, deleteSupervisor, notifications, updateNotification, centrosCustos } = useWorkshop();
    const { t } = useTranslation();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'blocked'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const [newSupervisor, setNewSupervisor] = useState({
        nome: '',
        email: '',
        telemovel: '',
        foto: '',
        cartrackKey: '',
        centroCustoId: ''
    });
    const [permissionUser, setPermissionUser] = useState<Supervisor | null>(null);



    const handleCreateSupervisor = (e: React.FormEvent) => {
        e.preventDefault();
        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

        addSupervisor({
            id: crypto.randomUUID(),
            nome: newSupervisor.nome,
            email: newSupervisor.email,
            telemovel: newSupervisor.telemovel,
            foto: newSupervisor.foto,
            status: 'active',
            pin: randomPin,
            dataRegisto: new Date().toISOString().split('T')[0],
            cartrackKey: newSupervisor.cartrackKey,
            centroCustoId: newSupervisor.centroCustoId
        });

        setNewSupervisor({ nome: '', email: '', telemovel: '', foto: '', cartrackKey: '', centroCustoId: '' });


        alert(`Supervisor criado com sucesso!\n\nPIN: ${randomPin}\n\nO supervisor pode entrar usando:\n- E-mail ou Telemóvel\n- PIN: ${randomPin}`);
    };

    const handleDeleteSupervisor = (id: string, name: string) => {
        if (confirm(`${t('supervisors.confirm_delete')} ${name}?`)) {
            deleteSupervisor(id);
        }
    };

    const handleSharePin = (user: Supervisor, type: 'whatsapp' | 'sms') => {
        const message = `${t('drivers.pin_share')} ${user.pin}.`;
        const cleanPhone = user.telemovel.replace(/[^0-9]/g, '');

        if (type === 'whatsapp') {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            window.open(`sms:${cleanPhone}?body=${encodeURIComponent(message)}`, '_self');
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = supervisors.length;
        const active = supervisors.filter(s => s.status === 'active').length;
        const pending = supervisors.filter(s => s.status === 'pending').length;
        const blocked = supervisors.filter(s => s.status === 'blocked').length;
        return { total, active, pending, blocked };
    }, [supervisors]);

    // Filtered and sorted supervisors
    const filteredItems = useMemo(() => {
        let filtered = supervisors.filter(s =>
            s.nome.toLowerCase().includes(filter.toLowerCase()) ||
            (s.email && s.email.toLowerCase().includes(filter.toLowerCase())) ||
            (s.telemovel && s.telemovel.includes(filter))
        );

        if (statusFilter !== 'all') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }

        filtered.sort((a, b) => {
            if (sortBy === 'name') return a.nome.localeCompare(b.nome);
            if (sortBy === 'date') {
                const dateA = a.dataRegisto || '0';
                const dateB = b.dataRegisto || '0';
                return dateB.localeCompare(dateA);
            }
            return 0;
        });

        return filtered;
    }, [supervisors, filter, statusFilter, sortBy]);

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-8 fade-in">
            {permissionUser && (
                <UserPermissionsModal
                    isOpen={true}
                    onClose={() => setPermissionUser(null)}
                    user={permissionUser}
                    role="supervisor"
                    onSave={(updated) => updateSupervisor(updated)}
                />
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <UserCog className="w-6 h-6 text-blue-400" />
                    </div>
                    {t('supervisors.title')}
                </h1>
                <p className="text-slate-400">{t('supervisors.subtitle')}</p>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-400/50" />
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.total}</p>
                    <p className="text-sm text-slate-400">{t('supervisors.stats.total')}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.active}</p>
                    <p className="text-sm text-slate-400">{t('supervisors.stats.active')}</p>
                </div>

                <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-amber-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.pending}</p>
                    <p className="text-sm text-slate-400">{t('supervisors.stats.pending')}</p>
                </div>

                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-red-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <UserX className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.blocked}</p>
                    <p className="text-sm text-slate-400">{t('supervisors.stats.blocked')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Add Form */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <h3 className="font-bold text-white mb-6 text-lg">{t('supervisors.form.title')}</h3>
                    <form onSubmit={handleCreateSupervisor} className="space-y-4">
                        {/* Static Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
                                <UserCog className="w-12 h-12 text-slate-600" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('supervisors.form.name')}</label>
                            <input
                                type="text"
                                required
                                value={newSupervisor.nome}
                                onChange={e => setNewSupervisor({ ...newSupervisor, nome: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                placeholder="Ex: Ana Santos"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('supervisors.form.email')}</label>
                                <input
                                    type="email"
                                    required
                                    value={newSupervisor.email}
                                    onChange={e => setNewSupervisor({ ...newSupervisor, email: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="email@algartempo.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('supervisors.form.phone')}</label>
                                <input
                                    type="tel"
                                    required
                                    value={newSupervisor.telemovel}
                                    onChange={e => setNewSupervisor({ ...newSupervisor, telemovel: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="910000000"
                                />
                            </div>
                        </div>

                        {/* Cost Center & Cartrack */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Centro de Custos</label>
                                <select
                                    value={newSupervisor.centroCustoId}
                                    onChange={e => setNewSupervisor({ ...newSupervisor, centroCustoId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                >
                                    <option value="">Selecionar...</option>
                                    {centrosCustos.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tag Cartrack (Opcional)</label>
                                <input
                                    type="text"
                                    value={newSupervisor.cartrackKey}
                                    onChange={e => setNewSupervisor({ ...newSupervisor, cartrackKey: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700 font-mono"
                                    placeholder="Chave Cartrack"
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
                            <Plus className="w-5 h-5" />
                            {t('supervisors.form.submit')}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg">{t('supervisors.list.title')}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('supervisors.view.list')}
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('supervisors.view.grid')}
                            >
                                <Grid3x3 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3 mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                            <input
                                type="text"
                                placeholder={t('drivers.search')}
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {(['all', 'active', 'pending', 'blocked'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                        }`}
                                >
                                    {t(`supervisors.filter.${status}`)}
                                </button>
                            ))}
                        </div>

                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        >
                            <option value="name">{t('supervisors.sort.name')}</option>
                            <option value="date">{t('supervisors.sort.date')}</option>
                        </select>
                    </div>

                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                        {filteredItems.length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">{t('supervisors.list.empty')}</p>
                            </div>
                        ) : (
                            filteredItems.map(supervisor => (
                                <div key={supervisor.id} className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'items-center justify-between'} p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl group hover:border-blue-500/20 transition-all`}>
                                    <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'flex-col' : 'flex-1'}`}>
                                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {supervisor.foto ? (
                                                <img src={supervisor.foto} alt={supervisor.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-blue-400 font-bold text-xs">{supervisor.nome.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className={viewMode === 'grid' ? 'w-full' : ''}>
                                            <p className="text-white font-medium text-sm">{supervisor.nome}</p>
                                            <p className="text-xs text-slate-500">{supervisor.email}</p>
                                            {viewMode === 'list' && (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit mt-1
                                                    ${supervisor.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        supervisor.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }
                                                `}>
                                                    {supervisor.status === 'active' ? t('supervisors.status.active') : supervisor.status === 'pending' ? 'Pendente' : t('supervisors.status.inactive')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {viewMode === 'list' && (
                                        <div className="flex items-center gap-2">
                                            {supervisor.pin && (
                                                <span className="font-mono text-xs bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 mr-2">PIN: {supervisor.pin}</span>
                                            )}
                                            <button
                                                onClick={() => handleSharePin(supervisor, 'sms')}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title={t('actions.share_sms')}
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSharePin(supervisor, 'whatsapp')}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                title={t('actions.share_whatsapp')}
                                            >
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setPermissionUser(supervisor)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/20"
                                                title="Gerir Permissões"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSupervisor(supervisor.id, supervisor.nome)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
