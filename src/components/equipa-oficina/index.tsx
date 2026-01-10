
import { useState, useMemo } from 'react';
import { Wrench, Plus, Trash2, Shield, Share2, MessageSquare, Search, TrendingUp, Users, UserX, Grid3x3, List, Upload, X } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { OficinaUser } from '../../types';
import UserPermissionsModal from '../permissoes/UserPermissionsModal';

export default function EquipaOficina() {
    const { oficinaUsers, addOficinaUser, updateOficinaUser, deleteOficinaUser } = useWorkshop();
    const { t } = useTranslation();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [photoPreview, setPhotoPreview] = useState<string>('');
    const [newOficinaUser, setNewOficinaUser] = useState({ nome: '', email: '', pin: '', foto: '' });
    const [permissionUser, setPermissionUser] = useState<OficinaUser | null>(null);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setPhotoPreview(base64);
                setNewOficinaUser({ ...newOficinaUser, foto: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateOficinaUser = (e: React.FormEvent) => {
        e.preventDefault();
        addOficinaUser({
            id: crypto.randomUUID(),
            nome: newOficinaUser.nome,
            email: newOficinaUser.email,
            pin: newOficinaUser.pin,
            foto: newOficinaUser.foto,
            status: 'active',
            dataRegisto: new Date().toISOString().split('T')[0]
        });
        setNewOficinaUser({ nome: '', email: '', pin: '', foto: '' });
        setPhotoPreview('');
        alert(t('team.success_create'));
    };

    const handleDeleteOficinaUser = (id: string, name: string) => {
        if (confirm(`${t('team.confirm_delete')} ${name}?`)) {
            deleteOficinaUser(id);
        }
    };

    const handleSharePin = (user: OficinaUser, type: 'whatsapp' | 'sms') => {
        const message = `${t('drivers.pin_share')} ${user.pin}.`;
        const phone = prompt(t('login.pin_request.phone') + ':', '');
        if (!phone) return;
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        if (type === 'whatsapp') {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            window.open(`sms:${cleanPhone}?body=${encodeURIComponent(message)}`, '_self');
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
            (u.email && u.email.toLowerCase().includes(filter.toLowerCase()))
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
        <div className="max-w-7xl mx-auto p-4 lg:p-8 h-full overflow-y-auto custom-scrollbar relative">
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
                        {/* Photo Upload */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Wrench className="w-12 h-12 text-slate-600" />
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 w-8 h-8 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                                    <Upload className="w-4 h-4 text-white" />
                                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                </label>
                                {photoPreview && (
                                    <button
                                        type="button"
                                        onClick={() => { setPhotoPreview(''); setNewOficinaUser({ ...newOficinaUser, foto: '' }); }}
                                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                                    >
                                        <X className="w-3 h-3 text-white" />
                                    </button>
                                )}
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
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('team.form.email')}</label>
                                <input
                                    type="email"
                                    required
                                    value={newOficinaUser.email}
                                    onChange={e => setNewOficinaUser({ ...newOficinaUser, email: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="email@algartempo.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('team.form.pin')}</label>
                                <input
                                    type="text"
                                    required
                                    value={newOficinaUser.pin}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setNewOficinaUser({ ...newOficinaUser, pin: val });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none mt-1 font-mono tracking-widest text-center transition-all hover:border-slate-700"
                                    placeholder="000000"
                                    pattern="\d{6}"
                                    minLength={6}
                                    maxLength={6}
                                    title="O PIN deve ter exatamente 6 dígitos numéricos"
                                />
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
                                placeholder={t('drivers.search')}
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
                                            <p className="text-xs text-slate-500">{user.email}</p>
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
