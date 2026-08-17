import { useState, useMemo } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { User, CheckCircle2, XCircle, Edit, Trash2, Shield, Wrench, Bus, Search, Filter } from 'lucide-react';
import UserFormModal from './modals/UserFormModal';
import { FrotaPageHeader } from '../../components/ui/frota/FrotaPageHeader';
import { FrotaKPI } from '../../components/ui/frota/FrotaKPI';

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
            <FrotaPageHeader
                title="Gestão de Utilizadores"
                subtitle="Gerencie todos os membros da equipa e suas funções."
                icon={User}
                actions={
                    <button
                        onClick={() => {
                            setSelectedUser(null);
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
                    >
                        Novo Utilizador
                    </button>
                }
            />

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <FrotaKPI title="Total Usuários" value={allUsers.length} icon={User} color="blue" />
                <FrotaKPI title="Supervisores" value={supervisors.length} icon={Shield} color="purple" />
                <FrotaKPI title="Gestores" value={gestores.length} icon={Shield} color="teal" />
                <FrotaKPI title="Motoristas" value={motoristas.length} icon={Bus} color="emerald" />
                <FrotaKPI title="Oficina" value={oficinaUsers.length} icon={Wrench} color="amber" />
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
