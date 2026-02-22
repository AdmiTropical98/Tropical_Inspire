import { useState, useEffect } from 'react';
import {
    Search, Mail,
    Ban, CheckCircle2, Key
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, UserStatus } from '../../types';

export default function UserManagement() {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
        const userToUpdate = users.find(u => u.id === userId);
        if (!userToUpdate) return;

        if (newStatus === 'BLOCKED' && userToUpdate.role === 'ADMIN_MASTER') {
            const activeMasters = users.filter(u => u.role === 'ADMIN_MASTER' && u.status === 'ACTIVE');
            if (activeMasters.length <= 1) {
                alert('Não é possível bloquear o último ADMIN_MASTER ativo.');
                return;
            }
        }

        if (!confirm(`Tem a certeza que deseja colocar o utilizador como ${newStatus}?`)) return;

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;

            // Log to Audit
            await supabase.from('audit_logs').insert({
                user_id: currentUser?.id,
                action: 'BACKOFFICE_USER_STATUS_CHANGE',
                module: 'backoffice',
                reference_id: userId,
                details: { old_status: userToUpdate.status, new_status: newStatus, email: userToUpdate.email }
            });

            fetchUsers();
        } catch (err) {
            console.error('Error updating user status:', err);
        }
    };

    const filteredUsers = users.filter(u =>
        u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/40 border border-slate-800/60 rounded-2xl py-3 pl-12 pr-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-md hover:border-slate-700/60 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${user.role === 'ADMIN_MASTER' ? 'bg-blue-600/10 text-blue-500 ring-2 ring-blue-500/20' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                    {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-black text-white">{user.nome || 'Sem Nome'}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${user.role === 'ADMIN_MASTER' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-bold">
                                        <span className="text-slate-500 flex items-center gap-1">
                                            <Mail className="w-3 h-3" /> {user.email}
                                        </span>
                                        <span className={`flex items-center gap-1 ${user.status === 'ACTIVE' ? 'text-emerald-500' : user.status === 'BLOCKED' ? 'text-red-500' : 'text-slate-500'
                                            }`}>
                                            {user.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                            {user.status || 'ACTIVE'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {user.status !== 'ACTIVE' && (
                                    <button
                                        onClick={() => handleStatusChange(user.id, 'ACTIVE')}
                                        className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 transition-all hover:text-white border border-emerald-500/20"
                                        title="Activar"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                )}
                                {user.status !== 'BLOCKED' && (
                                    <button
                                        onClick={() => handleStatusChange(user.id, 'BLOCKED')}
                                        className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 transition-all hover:text-white border border-red-500/20"
                                        title="Bloquear"
                                    >
                                        <Ban className="w-4 h-4" />
                                    </button>
                                )}
                                <button className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all hover:text-white border border-slate-700/60" title="Editar Permissões (Modo Terminal)">
                                    <Key className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
