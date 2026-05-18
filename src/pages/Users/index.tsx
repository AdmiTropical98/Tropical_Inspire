import { useState, useMemo } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { User, CheckCircle2, XCircle, Edit, Trash2, Shield, Wrench, Bus, Search, Filter } from 'lucide-react';
import UserFormModal from './modals/UserFormModal';

export default function UsersPage() {
    const {
        motoristas, supervisors, oficinaUsers, adminUsers, gestores,
        deleteMotorista, deleteSupervisor, deleteOficinaUser, deleteAdminUser, deleteGestor
    } = useWorkshop();

    const [searchTerm, setSearchTerm] = useState('');
    const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'admin' | 'motorista' | 'oficina' | 'supervisor' | 'gestor'>('all');

    // Combine all users into a single normalized list
    const allUsers = useMemo(() => {
        const admins = adminUsers.map(u => ({
            id: u.id,
            nome: u.nome || 'Administrador',
            email: u.email,
            role: 'admin' as const,
            status: 'active',
            lastAccess: null,
            avatar: null
        }));

        const drivers = motoristas.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: 'motorista' as const,
            status: (u.status === 'disponivel' || u.status === 'ocupado') ? 'active' : 'inactive',
            lastAccess: null,
            avatar: u.foto,
            // Extended fields for edit
            telemovel: u.contacto,
            cartaConducao: u.cartaConducao,
            vencimentoBase: u.vencimentoBase,
            valorHora: u.valorHora,
            turnoInicio: u.turnoInicio,
            turnoFim: u.turnoFim,
            folgas: u.folgas,
            pin: u.pin,
            blockedPermissions: u.blockedPermissions,
            centroCustoId: u.centroCustoId,
            tipoUtilizador: u.tipoUtilizador || 'motorista' // Preserve role type for driver-table users
        }));

        const mechanics = oficinaUsers.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: 'oficina' as const,
            status: u.status === 'active' ? 'active' : 'inactive',
            lastAccess: null,
            avatar: u.foto,
            telemovel: u.telemovel,
            pin: u.pin,
            blockedPermissions: u.blockedPermissions
        }));

        const sups = supervisors.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: 'supervisor' as const,
            status: u.status === 'active' ? 'active' : 'inactive',
            lastAccess: null,
            avatar: u.foto,
            telemovel: u.telemovel,
            pin: u.pin,
            password: u.password,
            blockedPermissions: u.blockedPermissions
        }));

        const managers = gestores.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: 'gestor' as const,
            status: u.status === 'active' ? 'active' : 'inactive',
            lastAccess: null,
            avatar: u.foto,
            telemovel: u.telemovel,
            pin: u.pin,
            password: u.password,
            blockedPermissions: u.blockedPermissions
        }));

        return [...admins, ...drivers, ...mechanics, ...sups, ...managers];
    }, [motoristas, supervisors, oficinaUsers, adminUsers, gestores]);

    // Filter Logic
    const filteredUsers = allUsers.filter(user => {
        const matchesSearch =
            user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = userTypeFilter === 'all' || user.role === userTypeFilter;
        return matchesSearch && matchesType;
    });

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold uppercase flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span>;
            case 'motorista': return <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold uppercase flex items-center gap-1"><Bus className="w-3 h-3" /> Motorista</span>;
            case 'oficina': return <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold uppercase flex items-center gap-1"><Wrench className="w-3 h-3" /> Oficina</span>;
            case 'supervisor': return <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold uppercase flex items-center gap-1"><User className="w-3 h-3" /> Supervisor</span>;
            case 'gestor': return <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold uppercase flex items-center gap-1"><Shield className="w-3 h-3" /> Gestor</span>;
            default: return <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">Outro</span>;
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const handleDelete = async (user: any) => {
        if (!confirm(`Tem a certeza que deseja eliminar o utilizador ${user.nome}?`)) return;

        try {
            if (user.role === 'motorista') await deleteMotorista(user.id);
            else if (user.role === 'supervisor') await deleteSupervisor(user.id);
            else if (user.role === 'gestor') await deleteGestor(user.id);
            else if (user.role === 'oficina') await deleteOficinaUser(user.id);
            else if (user.role === 'admin') await deleteAdminUser(user.id);
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Erro ao apagar utilizador.');
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Usuários</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{allUsers.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <User className="w-5 h-5 text-blue-400" />
                    </div>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Supervisores</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{supervisors.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Gestores</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{gestores.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                        <Shield className="w-5 h-5 text-teal-400" />
                    </div>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Motoristas</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{motoristas.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Bus className="w-5 h-5 text-emerald-400" />
                    </div>
                </div>

                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Oficina</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{oficinaUsers.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <Wrench className="w-5 h-5 text-orange-400" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        Gestão de Usuários
                    </h1>
                    <p className="text-slate-400 text-sm">Gerencie todos os membros da equipa e suas funções.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSelectedUser(null);
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-semibold"
                    >
                        Novo Utilizador
                    </button>
                </div>

            </div>

            {/* Filters */}
            <div className="bg-slate-50 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou email..."
                        className="w-full bg-white/90 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                    {['all', 'admin', 'motorista', 'oficina', 'supervisor', 'gestor'].map(type => (
                        <button
                            key={type}
                            onClick={() => setUserTypeFilter(type as any)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap
                                ${userTypeFilter === type
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-700'
                                }`}
                        >
                            {type === 'all' ? 'Todos' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-50 backdrop-blur-sm rounded-xl border border-slate-200/50 overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: '520px' }}>
                    <thead>
                        <tr className="bg-white/90 border-b border-slate-200/50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                            <th className="px-6 py-4">Utilizador</th>
                            <th className="px-6 py-4">Função</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="avatar-3d w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.nome} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-slate-400">{user.nome?.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{user.nome || 'Sem Nome'}</div>
                                                <div className="text-xs text-slate-500">{user.email || 'Sem email'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.status === 'active' ? (
                                            <div className="flex items-center gap-2 text-emerald-400 text-sm">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span>Ativo</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                                <XCircle className="w-4 h-4" />
                                                <span>Inativo</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Nenhum utilizador encontrado com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                }}
                user={selectedUser}
            />
        </div >
    );
}
