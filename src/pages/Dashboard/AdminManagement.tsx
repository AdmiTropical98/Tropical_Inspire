import { useState } from 'react';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Plus, Trash2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminManagement() {
    const { adminUsers, createAdminUser, deleteAdminUser } = useWorkshop();
    const { currentUser } = useAuth();
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ nome: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // Basic validation
        if (formData.password.length < 6) {
            setError('A palavra-passe deve ter pelo menos 6 caracteres.');
            setLoading(false);
            return;
        }

        const { success, error: apiError } = await createAdminUser(formData.email, formData.password, formData.nome);

        if (success) {
            setSuccess('Novo administrador criado com sucesso!');
            setFormData({ nome: '', email: '', password: '' });
            setTimeout(() => setIsCreating(false), 2000);
        } else {
            setError(apiError || 'Erro ao criar administrador.');
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem a certeza que deseja remover as permissões de administrador deste utilizador?')) {
            await deleteAdminUser(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-blue-500" />
                        Gestão de Administradores
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Gerir utilizadores com acesso total ao sistema
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Novo Administrador
                </button>
            </div>

            {isCreating && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-lg font-medium text-white mb-4">Adicionar Novo Administrador</h3>

                    {error && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400">
                            <CheckCircle className="w-5 h-5" />
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        value={formData.nome}
                                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Nome do Administrador"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium text-slate-400 uppercase">Palavra-Passe Inicial</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Esta palavra-passe será usada para o primeiro acesso.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'A criar...' : 'Criar Conta de Administrador'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {adminUsers.map(admin => (
                    <div key={admin.id} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                                <Shield className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">{admin.nome || 'Sem Nome'}</h3>
                                <p className="text-sm text-slate-400">{admin.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
                                {admin.role}
                            </span>
                            {/* Prevent deleting yourself explicitly if we wanted, but Supabase policy handles secure stuff too. 
                                Ideally we shouldn't let them delete themselves to avoid lockout, 
                                but standard logic usually allows it or warns.
                            */}
                            {currentUser?.email !== admin.email && (
                                <button
                                    onClick={() => handleDelete(admin.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Remover Administrador"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {adminUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                        Nenhum administrador encontrado.
                    </div>
                )}
            </div>
        </div>
    );
}
