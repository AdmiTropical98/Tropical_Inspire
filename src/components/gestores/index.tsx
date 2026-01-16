
import { useState, useMemo } from 'react';
import { Shield, Plus, Trash2, AlertCircle, Share2, MessageSquare, Search, TrendingUp, Users, UserX, Grid3x3, List, UserCheck, CheckCircle } from 'lucide-react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { Gestor, Notification } from '../../types';
import UserPermissionsModal from '../permissoes/UserPermissionsModal';

export default function Gestores() {
    const { gestores, addGestor, updateGestor, deleteGestor, notifications, updateNotification } = useWorkshop();
    const { } = useTranslation(); // Removed unused 't'
    // TODO: Ideally update translation files, but for now will hardcode or reuse similar keys
    
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'blocked'>('all');
    const [sortBy] = useState<'name' | 'date'>('name');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    const [newGestor, setNewGestor] = useState({ nome: '', email: '', telemovel: '', foto: '' });
    const [permissionUser, setPermissionUser] = useState<Gestor | null>(null);

    // Pending Requests Logic
    const pendingRequests = useMemo(() => {
        return notifications.filter(n =>
            n.type === 'registration_request' &&
            n.status === 'pending' &&
            n.data?.role === 'gestor'
        );
    }, [notifications]);

    const handleApproveRequest = async (request: Notification) => {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        // 1. Approve Notification
        await updateNotification({
            ...request,
            status: 'approved',
            response: { pin }
        });

        // WhatsApp Link creation with the generated PIN
        const cleanPhone = (request.data.telemovel || '').replace(/[^0-9]/g, '');
        const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Olá ${request.data.nome}, o seu pedido de registo foi aprovado. O seu PIN de acesso é: ${pin}`)}`;

        if (confirm(`Pedido Aprovado!\n\nPIN Gerado: ${pin}\n\nDeseja enviar o PIN agora via WhatsApp?`)) {
            window.open(whatsappLink, '_blank');
        }
    };

    const handleCreateGestor = async (e: React.FormEvent) => {
        e.preventDefault();
        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

        const result = await addGestor({
            id: crypto.randomUUID(),
            nome: newGestor.nome,
            email: newGestor.email,
            telemovel: newGestor.telemovel,
            foto: newGestor.foto,
            status: 'active',
            pin: randomPin,
            dataRegisto: new Date().toISOString().split('T')[0]
        });

        if (result && result.error) {
            alert(`Erro ao criar gestor: ${result.error.message || 'Erro desconhecido'}`);
            return; // Stop here on error
        }

        setNewGestor({ nome: '', email: '', telemovel: '', foto: '' });

        alert(`Gestor criado com sucesso!\n\nPIN: ${randomPin}\n\nO gestor pode entrar usando:\n- E-mail ou Telemóvel\n- PIN: ${randomPin}`);
    };

    const handleDeleteGestor = (id: string, name: string) => {
        if (confirm(`Tem a certeza que deseja eliminar o Gestor ${name}?`)) {
            deleteGestor(id);
        }
    };

    const handleSharePin = (user: Gestor, type: 'whatsapp' | 'sms') => {
        const message = `Seu PIN de acesso é ${user.pin}.`;
        const cleanPhone = user.telemovel.replace(/[^0-9]/g, '');

        if (type === 'whatsapp') {
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
        } else {
            window.open(`sms:${cleanPhone}?body=${encodeURIComponent(message)}`, '_self');
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = gestores.length;
        const active = gestores.filter(s => s.status === 'active').length;
        // Gestores don't typically have 'pending' like Supervisors might in some flows, but we keep structure
        const blocked = gestores.filter(s => s.status === 'blocked').length;
        return { total, active, blocked };
    }, [gestores]);

    // Filtered and sorted
    const filteredItems = useMemo(() => {
        let filtered = gestores.filter(s =>
            s.nome.toLowerCase().includes(filter.toLowerCase()) ||
            (s.email && s.email.toLowerCase().includes(filter.toLowerCase())) ||
            (s.telemovel && s.telemovel.includes(filter))
        );

        if (statusFilter !== 'all') {
            if (statusFilter === 'pending') {
                 // Gestor type usually 'active' | 'blocked', so check logic
                 // If Gestor type allows pending update it, otherwise ignore
                 return []; 
            }
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
    }, [gestores, filter, statusFilter, sortBy]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            {permissionUser && (
                <UserPermissionsModal
                    isOpen={true}
                    onClose={() => setPermissionUser(null)}
                    user={permissionUser as any} // Cast safely as interfaces align on permissions
                    role={"gestor" as any}
                    onSave={(updated) => updateGestor(updated as any)}
                />
            )}


    // Pending Requests Logic
    const pendingRequests = useMemo(() => {
        return notifications.filter(n =>
            n.type === 'registration_request' &&
            n.status === 'pending' &&
            n.data?.role === 'gestor'
            );
    }, [notifications]);

    const handleApproveRequest = async (request: Notification) => {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

            // 1. Approve Notification
            await updateNotification({
                ...request,
                status: 'approved',
            response: {pin}
        });

            // 2. Alert Admin (or auto-create user? Logic says specific "Admin creates user after validation")
            // NOTE: The previous flow in Login.tsx implies the User enters the PIN to finalize.
            // So we just need to provide the PIN to the Admin so they can send it.
            alert(`Pedido Aprovado!\n\nPIN Gerado: ${pin}\n\nEnvie este PIN ao requerente para que ele possa concluir o registo.`);
    };

            return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
                {permissionUser && (
                    <UserPermissionsModal
                        isOpen={true}
                        onClose={() => setPermissionUser(null)}
                        user={permissionUser as any} // Cast safely as interfaces align on permissions
                        role={"gestor" as any}
                        onSave={(updated) => updateGestor(updated as any)}
                    />
                )}


            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                        <UserCheck className="w-6 h-6 text-teal-400" />
                    </div>
                    Gestores
                </h1>
                <p className="text-slate-400">Gerir equipa de gestão e permissões administrativas.</p>
            </div>

                {/* Pending Requests Section */}
                {pendingRequests.length > 0 && (
                    <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-6 mb-8">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-teal-400" />
                            Pedidos de Registo Pendentes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingRequests.map(req => (
                                <div key={req.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full border border-yellow-500/20">
                                            Pendente
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-white">{req.data.nome || 'Sem Nome'}</h4>
                                    <div className="text-sm text-slate-400 space-y-1 mt-2">
                                        <p className="flex items-center gap-2">
                                            <span className="opacity-50">Email:</span>
                                            {req.data.email}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <span className="opacity-50">Tel:</span>
                                            {req.data.telemovel}
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-2">
                                        <button
                                            onClick={() => handleApproveRequest(req)}
                                            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-3 h-3" />
                                            Gerar PIN & Aprovar
                                        </button>
                                        <button
                                            onClick={() => {
                                                const cleanPhone = (req.data.telemovel || '').replace(/[^0-9]/g, '');
                                                // Since we haven't generated a PIN yet, we can't send it. 
                                                // User requested "send PIN via whatsapp". 
                                                // This implies the PIN must be generated first.
                                                // So this button is only useful if we auto-gen PIN or if we do it in one step.
                                                // I'll make the Approve button show the PIN, and maybe enable WhatsApp sending AFTER approval?
                                                // Or, I'll add a 'Send WhatsApp' that generates a proposed PIN?
                                                // Simpler: Just open WhatsApp with a generic "Hello" or do nothing until approved. 
                                                // User asked: "botão para que eu mande o pin".
                                                // I will hide this button here or just make it open empty chat.
                                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                                            }}
                                            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg flex items-center justify-center transition-colors"
                                            title="Abrir WhatsApp"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-400/50" />
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.total}</p>
                    <p className="text-sm text-slate-400">Total de Gestores</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.active}</p>
                    <p className="text-sm text-slate-400">Ativos</p>
                </div>

                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 hover:shadow-lg hover:shadow-red-500/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <UserX className="w-6 h-6 text-red-400" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stats.blocked}</p>
                    <p className="text-sm text-slate-400">Bloqueados</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Add Form */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <h3 className="font-bold text-white mb-6 text-lg">Adicionar Novo Gestor</h3>
                    <form onSubmit={handleCreateGestor} className="space-y-4">
                        {/* Static Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center">
                                <Shield className="w-12 h-12 text-slate-600" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome Completo</label>
                            <input
                                type="text"
                                required
                                value={newGestor.nome}
                                onChange={e => setNewGestor({ ...newGestor, nome: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                placeholder="Ex: Gestor Silva"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={newGestor.email}
                                    onChange={e => setNewGestor({ ...newGestor, email: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="gestor@algartempo.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Telemóvel</label>
                                <input
                                    type="tel"
                                    required
                                    value={newGestor.telemovel}
                                    onChange={e => setNewGestor({ ...newGestor, telemovel: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none mt-1 transition-all hover:border-slate-700"
                                    placeholder="910000000"
                                />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
                            <Plus className="w-5 h-5" />
                            Criar Gestor
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 lg:p-8 h-fit">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg">Lista de Gestores</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Lista"
                            >
                                <List className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Grelha"
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
                                placeholder="Pesquisar gestores..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {(['all', 'active', 'blocked'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                        }`}
                                >
                                    {status === 'all' ? 'Todos' : status === 'active' ? 'Ativos' : 'Bloqueados'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                        {filteredItems.length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed">
                                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">Nenhum gestor encontrado.</p>
                            </div>
                        ) : (
                            filteredItems.map(gestor => (
                                <div key={gestor.id} className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'items-center justify-between'} p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl group hover:border-blue-500/20 transition-all`}>
                                    <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'flex-col' : 'flex-1'}`}>
                                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {gestor.foto ? (
                                                <img src={gestor.foto} alt={gestor.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-teal-400 font-bold text-xs">{gestor.nome.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className={viewMode === 'grid' ? 'w-full' : ''}>
                                            <p className="text-white font-medium text-sm">{gestor.nome}</p>
                                            <p className="text-xs text-slate-500">{gestor.email}</p>
                                            {viewMode === 'list' && (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit mt-1
                                                    ${gestor.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }
                                                `}>
                                                    {gestor.status === 'active' ? 'Ativo' : 'Bloqueado'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {viewMode === 'list' && (
                                        <div className="flex items-center gap-2">
                                            {gestor.pin && (
                                                <span className="font-mono text-xs bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-800 mr-2">PIN: {gestor.pin}</span>
                                            )}
                                            <button
                                                onClick={() => handleSharePin(gestor, 'sms')}
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Partilhar por SMS"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSharePin(gestor, 'whatsapp')}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                title="Partilhar por WhatsApp"
                                            >
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setPermissionUser(gestor)}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/20"
                                                title="Gerir Permissões"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGestor(gestor.id, gestor.nome)}
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
