
import { useState, useMemo } from 'react';
import { Wrench, Plus, Trash2, Shield, Share2, MessageSquare, Search, TrendingUp, Users, UserX, Grid3x3, List } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { OficinaUser } from '../../types';
import UserPermissionsModal from '../Permissoes/UserPermissionsModal';

export default function EquipaOficina() {
    const { oficinaUsers, addOficinaUser, updateOficinaUser, deleteOficinaUser, centrosCustos } = useWorkshop();
    const { t } = useTranslation();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const [newOficinaUser, setNewOficinaUser] = useState({ nome: '', telemovel: '', foto: '', centroCustoId: '' });
    const [permissionUser, setPermissionUser] = useState<OficinaUser | null>(null);



    const handleCreateOficinaUser = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic Phone Validation
        if (!/^\d{9,}$/.test(newOficinaUser.telemovel)) {
            alert(t('team.form.phone_error') || 'O telemóvel deve ter pelo menos 9 dígitos.');
            return;
        }

        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

        const result = await addOficinaUser({
            id: crypto.randomUUID(),
            nome: newOficinaUser.nome,
            telemovel: newOficinaUser.telemovel,
            pin: randomPin,
            foto: newOficinaUser.foto,
            status: 'active',
            dataRegisto: new Date().toISOString().split('T')[0],
            email: '', // Add default empty email if not provided
            blockedPermissions: [],
            centroCustoId: newOficinaUser.centroCustoId
        });

        if (result && result.error) {
            alert('Erro ao criar utilizador: ' + result.error.message);
            return;
        }

        setNewOficinaUser({ nome: '', telemovel: '', foto: '', centroCustoId: '' });

        alert(`${t('team.success_create')} PIN: ${randomPin}`);
    };

    const handleDeleteOficinaUser = (id: string, name: string) => {
        if (confirm(`${t('team.confirm_delete')} ${name}?`)) {
            deleteOficinaUser(id);
        }
    };

    const handleSharePin = (user: OficinaUser, type: 'whatsapp' | 'sms') => {
        const message = `${t('drivers.pin_share')} ${user.pin}.`;
        const phone = user.telemovel ? user.telemovel.replace(/[^0-9]/g, '') : '';
        if (!phone) {
            alert('Utilizador sem telemóvel definido.');
            return;
        }

        if (type === 'whatsapp') {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_self');
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = oficinaUsers.length;
        const active = oficinaUsers.filter(u => u.status === 'active').length;
        const blocked = oficinaUsers.filter(u => u.status === 'blocked').length;
        return { total, active, blocked };
    }, [oficinaUsers]);

    // Filtered and sorted users
    const filteredItems = useMemo(() => {
        let filtered = oficinaUsers.filter(u =>
            u.nome.toLowerCase().includes(filter.toLowerCase()) ||
            (u.telemovel && u.telemovel.includes(filter))
        );

        if (statusFilter !== 'all') {
            filtered = filtered.filter(u => u.status === statusFilter);
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
    }, [oficinaUsers, filter, statusFilter, sortBy]);

    return (
        <div className="w-full max-w-[1600px] mx-auto p-6 space-y-8 fade-in relative">
            {permissionUser && (
                <UserPermissionsModal
                    isOpen={true}
                    onClose={() => setPermissionUser(null)}
                    user={permissionUser}
                    role="oficina"
                    onSave={(updated) => updateOficinaUser(updated)}
                />
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <Wrench className="w-6 h-6 text-orange-400" />
                    </div>
                    {t('team.title')}
                </h1>
                <p className="text-slate-400">{t('team.subtitle')}</p>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-orange-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-orange-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-orange-400/50" />
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.total}</p>
                    <p className="text-sm text-slate-400">{t('team.stats.total')}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.active}</p>
                    <p className="text-sm text-slate-400">{t('team.stats.active')}</p>
                </div>

                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-red-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <UserX className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.blocked}</p>
                    <p className="text-sm text-slate-400">{t('team.stats.blocked')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Add Form */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <h3 className="font-bold text-white mb-6 text-lg">{t('team.form.title')}</h3>
                    <form onSubmit={handleCreateOficinaUser} className="space-y-4">
                        {/* Static Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
                                <Wrench className="w-12 h-12 text-slate-600" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('team.form.name')}</label>
                            <input
                                type="text"
                                required
                                value={newOficinaUser.nome}
                                onChange={e => setNewOficinaUser({ ...newOficinaUser, nome: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none mt-1 transition-all hover:border-slate-700"
                                placeholder="Ex: Manuel Silva"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Telemóvel</label>
                                <input
                                    type="tel"
                                    required
                                    value={newOficinaUser.telemovel}
                                    onChange={e => setNewOficinaUser({ ...newOficinaUser, telemovel: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="912 345 678"
                                    pattern="[0-9]{9,}"
                                    title="Mínimo 9 dígitos"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Centro de Custos</label>
                                <select
                                    value={newOficinaUser.centroCustoId}
                                    onChange={e => setNewOficinaUser({ ...newOficinaUser, centroCustoId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none mt-1 transition-all hover:border-slate-700"
                                >
                                    <option value="">Selecionar...</option>
                                    {centrosCustos.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
                            <Plus className="w-5 h-5" />
                            {t('team.form.submit')}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg">{t('team.list.title')}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('team.view.list')}
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('team.view.grid')}
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
                                placeholder="Pesquisar..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 outline-none transition-all"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {(['all', 'active', 'blocked'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                        }`}
                                >
                                    {t(`team.filter.${status}`)}
                                </button>
                            ))}
                        </div>

                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
                        >
                            <option value="name">{t('team.sort.name')}</option>
                            <option value="date">{t('team.sort.date')}</option>
                        </select>
                    </div>

                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                        {filteredItems.length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                <p className="text-slate-400 text-sm">{t('team.list.empty')}</p>
                            </div>
                        ) : (
                            filteredItems.map(user => (
                                <div key={user.id} className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'items-center justify-between'} p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl group hover:border-orange-500/20 transition-all`}>
                                    <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'flex-col' : 'flex-1'}`}>
                                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {user.foto ? (
                                                <img src={user.foto} alt={user.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-orange-400 font-bold text-xs">{user.nome.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className={viewMode === 'grid' ? 'w-full' : ''}>
                                            <p className="text-white font-medium text-sm">{user.nome}</p>
                                            <p className="text-xs text-slate-500">{user.telemovel || 'Sem contacto'}</p>
                                        </div>
                                    </div>
                                    {viewMode === 'list' && (
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 mr-2">PIN: {user.pin}</span>
                                            <button
                                                onClick={() => handleSharePin(user, 'sms')}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title={t('actions.share_sms')}
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSharePin(user, 'whatsapp')}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                title={t('actions.share_whatsapp')}
                                            >
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setPermissionUser(user)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Gerir Permissões"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOficinaUser(user.id, user.nome)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
