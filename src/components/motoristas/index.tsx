
import { useState, useMemo } from 'react';
import { Plus, Search, User, Phone, Mail, FileText, Trash2, Calendar, Share2, Shield, MessageSquare, TrendingUp, AlertTriangle, Euro, Grid3x3, List, Upload, X } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Motorista } from '../../types';
import DriverProfile from './DriverProfile';
import UserPermissionsModal from '../permissoes/UserPermissionsModal';

export default function Motoristas() {
    const { motoristas, addMotorista, updateMotorista, deleteMotorista } = useWorkshop();
    const { t } = useTranslation();
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_leave' | 'holidays' | 'sick'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'salary'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [selectedDriver, setSelectedDriver] = useState<Motorista | null>(null);
    const [permissionUser, setPermissionUser] = useState<Motorista | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>('');
    const [formData, setFormData] = useState<Omit<Motorista, 'id' | 'pin'>>({
        nome: '',
        contacto: '',
        cartaConducao: '',
        email: '',
        vencimentoBase: 0,
        valorHora: 0,
        obs: '',
        foto: '',
        cartrackKey: ''
    });

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setPhotoPreview(base64);
                setFormData({ ...formData, foto: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();

        const newMotorista: Motorista = {
            ...formData,
            id: crypto.randomUUID(),
            pin: newPin,
            dataRegisto: new Date().toISOString().split('T')[0]
        };

        addMotorista(newMotorista);
        setFormData({ nome: '', contacto: '', cartaConducao: '', email: '', vencimentoBase: 0, valorHora: 0, obs: '', foto: '', cartrackKey: '' });
        setPhotoPreview('');
        alert(`${t('drivers.success_msg')}: ${newPin} `);
        setSelectedDriver(newMotorista);
    };

    const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (confirm(`${t('drivers.delete_confirm')} ${name}?`)) {
            deleteMotorista(id);
        }
    };

    const sharePin = (e: React.MouseEvent, motorista: Motorista, type: 'whatsapp' | 'sms') => {
        e.stopPropagation();
        if (!motorista.pin) return;
        const message = `${t('drivers.pin_share')} ${motorista.pin}.`;
        const cleanPhone = motorista.contacto.replace(/[^0-9]/g, '');

        if (type === 'whatsapp') {
            if (cleanPhone) {
                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
            } else {
                alert(`Sem contacto válido. PIN: ${motorista.pin}`);
            }
        } else {
            if (cleanPhone) {
                window.open(`sms:${cleanPhone}?body=${encodeURIComponent(message)}`, '_self');
            } else {
                alert(`Sem contacto válido. PIN: ${motorista.pin}`);
            }
        }
    };

    const getDriverStatus = (m: Motorista) => {
        const today = new Date();
        const dayOfWeek = today.toLocaleString('pt-PT', { weekday: 'long' });
        const normalizedDay = dayOfWeek.split('-')[0].charAt(0).toUpperCase() + dayOfWeek.split('-')[0].slice(1);

        const activeAbsence = m.ausencias?.find(a => {
            const start = new Date(a.inicio);
            const end = new Date(a.fim);
            const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

            return todayDate >= startDate && todayDate <= endDate && a.aprovado;
        });

        if (activeAbsence) {
            switch (activeAbsence.tipo) {
                case 'ferias': return { label: t('drivers.status.holidays'), color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', type: 'holidays' };
                case 'baixa': return { label: t('drivers.status.sick'), color: 'bg-red-500/20 text-red-400 border-red-500/30', type: 'sick' };
                case 'folga': return { label: t('drivers.status.off'), color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', type: 'on_leave' };
                default: return { label: t('drivers.status.absent'), color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', type: 'on_leave' };
            }
        }

        if (m.folgas?.includes(normalizedDay)) {
            return { label: t('drivers.status.off'), color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', type: 'on_leave' };
        }

        return null;
    };

    // Statistics calculations
    const stats = useMemo(() => {
        const total = motoristas.length;
        const onLeave = motoristas.filter(m => {
            const status = getDriverStatus(m);
            return status !== null;
        }).length;

        const pendingIssues = motoristas.reduce((acc, m) => {
            const unpaidFines = m.multas?.filter(multa => !multa.pago).length || 0;
            const pendingAccidents = m.acidentes?.filter(acc => acc.status !== 'resolvido').length || 0;
            return acc + unpaidFines + pendingAccidents;
        }, 0);

        const monthlyCosts = motoristas.reduce((acc, m) => acc + (m.vencimentoBase || 0), 0);

        return { total, onLeave, pendingIssues, monthlyCosts };
    }, [motoristas]);

    // Filtered and sorted drivers
    const filteredItems = useMemo(() => {
        let filtered = motoristas.filter(m =>
            m.nome.toLowerCase().includes(filter.toLowerCase()) ||
            (m.contacto && m.contacto.includes(filter)) ||
            (m.email && m.email.toLowerCase().includes(filter.toLowerCase()))
        );

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(m => {
                const status = getDriverStatus(m);
                if (statusFilter === 'active') return status === null;
                return status?.type === statusFilter;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            if (sortBy === 'name') return a.nome.localeCompare(b.nome);
            if (sortBy === 'date') {
                const dateA = a.dataRegisto || '0';
                const dateB = b.dataRegisto || '0';
                return dateB.localeCompare(dateA);
            }
            if (sortBy === 'salary') {
                return (b.vencimentoBase || 0) - (a.vencimentoBase || 0);
            }
            return 0;
        });

        return filtered;
    }, [motoristas, filter, statusFilter, sortBy]);

    return (
        <div className="max-w-7xl mx-auto p-4 lg:p-8 h-full overflow-y-auto custom-scrollbar relative">
            {selectedDriver && (
                <DriverProfile
                    motorista={selectedDriver}
                    onClose={() => setSelectedDriver(null)}
                />
            )}

            {permissionUser && (
                <UserPermissionsModal
                    isOpen={true}
                    onClose={() => setPermissionUser(null)}
                    user={permissionUser}
                    role="motorista"
                    onSave={(updated) => updateMotorista(updated)}
                />
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <User className="w-6 h-6 text-blue-400" />
                    </div>
                    {t('drivers.title')}
                </h1>
                <p className="text-slate-400">{t('drivers.subtitle')}</p>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-400/50" />
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.total}</p>
                    <p className="text-sm text-slate-400">{t('drivers.stats.total')}</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.onLeave}</p>
                    <p className="text-sm text-slate-400">{t('drivers.stats.on_leave')}</p>
                </div>

                <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.pendingIssues}</p>
                    <p className="text-sm text-slate-400">{t('drivers.stats.pending_issues')}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Euro className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.monthlyCosts.toFixed(0)}€</p>
                    <p className="text-sm text-slate-400">{t('drivers.stats.monthly_costs')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Add Form */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <h3 className="font-bold text-white mb-6 text-lg">{t('drivers.new')}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Photo Upload */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-12 h-12 text-slate-600" />
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                                    <Upload className="w-4 h-4 text-white" />
                                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                </label>
                                {photoPreview && (
                                    <button
                                        type="button"
                                        onClick={() => { setPhotoPreview(''); setFormData({ ...formData, foto: '' }); }}
                                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                                    >
                                        <X className="w-3 h-3 text-white" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.name')}</label>
                            <input
                                type="text"
                                required
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                placeholder="Ex: João Silva"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.phone')}</label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.contacto}
                                    onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="912 345 678"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.license')}</label>
                                <input
                                    type="text"
                                    value={formData.cartaConducao}
                                    onChange={e => setFormData({ ...formData, cartaConducao: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="L-1234567"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.email')}</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                placeholder="motorista@algartempo.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Chave Cartrack</label>
                            <input
                                type="text"
                                value={formData.cartrackKey || ''}
                                onChange={e => setFormData({ ...formData, cartrackKey: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700 font-mono"
                                placeholder="Ex: A0000001666B8F01"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.salary')}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.vencimentoBase}
                                        onChange={e => setFormData({ ...formData, vencimentoBase: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-1/2 translate-y-0 text-slate-500 text-sm font-bold">€</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.hourly_rate')}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.valorHora}
                                        onChange={e => setFormData({ ...formData, valorHora: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-1/2 translate-y-0 text-slate-500 text-sm font-bold">€</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('drivers.form.obs')}</label>
                            <textarea
                                value={formData.obs}
                                onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700 resize-none"
                                placeholder={t('req.obs')}
                                rows={3}
                            />
                        </div>

                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
                            <Plus className="w-5 h-5" />
                            {t('drivers.form.submit')}
                        </button>
                    </form>
                </div>

                {/* List & Search */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg">{t('drivers.list.title')}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('drivers.view.list')}
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={t('drivers.view.grid')}
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
                            {(['all', 'active', 'on_leave', 'holidays', 'sick'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                        }`}
                                >
                                    {t(`drivers.filter.${status}`)}
                                </button>
                            ))}
                        </div>

                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        >
                            <option value="name">{t('drivers.sort.name')}</option>
                            <option value="date">{t('drivers.sort.date')}</option>
                            <option value="salary">{t('drivers.sort.salary')}</option>
                        </select>
                    </div>

                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                        {filteredItems.length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                <p className="text-slate-400 text-sm">{t('drivers.empty')}</p>
                            </div>
                        ) : (
                            filteredItems.map(motorista => {
                                const status = getDriverStatus(motorista);
                                return (
                                    <div
                                        key={motorista.id}
                                        onClick={() => setSelectedDriver(motorista)}
                                        className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row'} items-center ${viewMode === 'grid' ? 'justify-center' : 'justify-between'} p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl group hover:border-blue-500/20 transition-all hover:bg-slate-800/50 cursor-pointer hover:shadow-lg hover:shadow-blue-500/5`}
                                    >
                                        <div className={`flex items-center gap-4 ${viewMode === 'grid' ? 'flex-col text-center' : 'flex-1 min-w-0 mr-4'}`}>
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {motorista.foto ? (
                                                        <img src={motorista.foto} alt={motorista.nome} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-blue-400 font-bold text-lg">{motorista.nome.charAt(0)}</span>
                                                    )}
                                                </div>
                                                {status && (
                                                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border shadow-sm whitespace-nowrap ${status.color}`}>
                                                        {status.label}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={viewMode === 'grid' ? 'w-full' : 'min-w-0'}>
                                                <p className={`text-white font-medium ${viewMode === 'grid' ? 'text-center' : 'truncate'} group-hover:text-blue-400 transition-colors`}>{motorista.nome}</p>
                                                {viewMode === 'list' && (
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                                                        <span className="flex items-center gap-1 shrink-0">
                                                            <Phone className="w-3 h-3" />
                                                            {motorista.contacto}
                                                        </span>
                                                        {motorista.email && (
                                                            <span className="flex items-center gap-1 border-l border-slate-700 pl-3 truncate max-w-[150px] sm:max-w-[200px]">
                                                                <Mail className="w-3 h-3 shrink-0" />
                                                                <span className="truncate">{motorista.email}</span>
                                                            </span>
                                                        )}
                                                        {motorista.folgas && motorista.folgas.length > 0 && (
                                                            <span className="flex items-center gap-1 border-l border-slate-700 pl-3 shrink-0 text-slate-400">
                                                                <Calendar className="w-3 h-3 text-slate-500" />
                                                                <span className="text-[10px] uppercase font-bold">Folgas: {motorista.folgas.join(', ')}</span>
                                                            </span>
                                                        )}
                                                        {motorista.cartaConducao && (
                                                            <span className="flex items-center gap-1 border-l border-slate-700 pl-3 shrink-0">
                                                                <FileText className="w-3 h-3" />
                                                                {motorista.cartaConducao}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {viewMode === 'list' && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                {motorista.pin && (
                                                    <div className="hidden xl:flex items-center gap-2 mr-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50">
                                                        <span className="font-mono text-xs text-slate-400">PIN:</span>
                                                        <span className="font-mono text-sm font-bold text-emerald-400 tracking-widest">{motorista.pin}</span>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={(e) => sharePin(e, motorista, 'sms')}
                                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="Enviar PIN por SMS"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={(e) => sharePin(e, motorista, 'whatsapp')}
                                                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Enviar PIN por WhatsApp"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPermissionUser(motorista); }}
                                                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="Gerir Permissões"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                </button>

                                                <button
                                                    onClick={(e) => handleDelete(e, motorista.id, motorista.nome)}
                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar Motorista"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
