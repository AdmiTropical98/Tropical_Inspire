import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import { 
    User, Mail, Phone, Key, CreditCard, Clock, 
    Save, Shield, AlertCircle, CheckCircle2,
    Car, Wrench, ShieldAlert, ClipboardCheck, UserCog
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MyProfile() {
    const { currentUser, userRole, refreshCurrentUser } = useAuth();
    const { updateMotorista, updateSupervisor, updateOficinaUser } = useWorkshop();
    
    // Local state for form
    const [formData, setFormData] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    // Initialize data
    useEffect(() => {
        if (currentUser) {
            setFormData({
                ...currentUser,
                // Normalize fields
                telemovel: (currentUser as any).telemovel || (currentUser as any).contacto || '',
                password: (currentUser as any).password || '',
            });
        }
    }, [currentUser]);

    // Clear messages after 3s
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            if (userRole === 'motorista') {
                await updateMotorista({
                    ...currentUser, // Keep existing fields
                    nome: formData.nome,
                    email: formData.email,
                    contacto: formData.telemovel,
                    cartaConducao: formData.cartaConducao,
                    pin: formData.pin,
                } as any);
            } else if (userRole === 'supervisor') {
                await updateSupervisor({
                    ...currentUser,
                    nome: formData.nome,
                    email: formData.email,
                    telemovel: formData.telemovel,
                    pin: formData.pin,
                    password: formData.password
                } as any);
            } else if (userRole === 'oficina') {
                await updateOficinaUser({
                    ...currentUser,
                    nome: formData.nome,
                    email: formData.email,
                    telemovel: formData.telemovel,
                    pin: formData.pin
                } as any);
            } else if (userRole === 'admin') {
                // Admin updates via Supabase Auth or specific table if exists
                const { error } = await supabase.auth.updateUser({
                    email: formData.email || undefined,
                    password: formData.password || undefined,
                    data: { full_name: formData.nome }
                });
                if (error) throw error;
            }

            await refreshCurrentUser();
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Erro ao atualizar: ' + (error.message || 'Tente novamente.') });
        } finally {
            setIsLoading(false);
        }
    };

    const getRoleIcon = () => {
        switch (userRole) {
            case 'motorista':
                return <Car className="w-16 h-16 text-white" />;
            case 'oficina':
                return <Wrench className="w-16 h-16 text-white" />;
            case 'supervisor':
                return <ClipboardCheck className="w-16 h-16 text-white" />;
            case 'admin':
                return <UserCog className="w-16 h-16 text-white" />;
            default:
                return <User className="w-16 h-16 text-white" />;
        }
    };

    const getRoleGradient = () => {
        switch (userRole) {
            case 'motorista': return 'from-blue-600 to-cyan-600';
            case 'oficina': return 'from-orange-500 to-amber-500';
            case 'supervisor': return 'from-purple-600 to-indigo-600';
            case 'admin': return 'from-red-600 to-rose-600';
            default: return 'from-slate-600 to-slate-500';
        }
    };

    if (!currentUser) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                    Meu Perfil
                </h1>
                <p className="text-slate-400 mt-1">Gerencie suas informações pessoais e credenciais.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Quick Info */}
                <div className="space-y-6">
                    <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-8 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="relative mb-6">
                            <div className={`w-32 h-32 rounded-full border-4 border-slate-800 shadow-2xl overflow-hidden bg-gradient-to-br ${getRoleGradient()} flex items-center justify-center`}>
                                {getRoleIcon()}
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-white mb-1">{formData.nome}</h2>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 border border-slate-700">
                            <Shield className="w-3 h-3" />
                            {userRole}
                        </span>
                    </div>

                    {/* Stats/Extra Info if needed */}
                    {userRole === 'motorista' && (
                        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 space-y-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Detalhes Profissionais</h3>
                            
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase">Vencimento Base</p>
                                    <p className="font-mono font-bold">{Number(formData.vencimentoBase || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase">Horário Turno</p>
                                    <p className="font-mono font-bold">{formData.turnoInicio} - {formData.turnoFim}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Edit Form */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSave} className="bg-[#0f172a] rounded-2xl border border-slate-800 p-8 space-y-8 relative overflow-hidden">
                        
                        {/* Feedback Message */}
                        {message && (
                            <div className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-center gap-2 text-sm font-bold animate-in slide-in-from-top-4 
                                ${message.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {message.text}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <User className="w-5 h-5 text-blue-500" />
                                    Informações Pessoais
                                </h3>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.nome || ''}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Email</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    />
                                </div>
                            </div>
                            
                            {(userRole === 'motorista' || userRole === 'supervisor' || userRole === 'oficina') && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Telemóvel</label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                        <input
                                            type="tel"
                                            value={formData.telemovel || ''}
                                            onChange={e => setFormData({ ...formData, telemovel: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                             {userRole === 'motorista' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Carta de Condução</label>
                                    <input
                                        type="text"
                                        value={formData.cartaConducao || ''}
                                        onChange={e => setFormData({ ...formData, cartaConducao: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <Key className="w-5 h-5 text-amber-500" />
                                    Segurança
                                </h3>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">PIN de Acesso</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={formData.pin || ''}
                                    onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono tracking-widest text-center focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                                    placeholder="••••"
                                />
                            </div>

                            {(userRole === 'supervisor' || userRole === 'admin') && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400">Password</label>
                                    <input
                                        type="password"
                                        value={formData.password || ''}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                                        placeholder="Nova password..."
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        A processar...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Gravar Alterações
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
