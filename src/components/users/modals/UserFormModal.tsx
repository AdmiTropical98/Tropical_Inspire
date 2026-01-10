import { useState, useEffect } from 'react';
import { X, Save, Shield, User, Key, DollarSign, Clock } from 'lucide-react';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { useWorkshop } from '../../../contexts/WorkshopContext';

type UserRole = 'admin' | 'motorista' | 'supervisor' | 'oficina';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: any; // If null, create mode
    initialRole?: UserRole;
}

const PERMISSION_LABELS: Record<string, string> = {
    'requisicoes': 'Ver Requisições',
    'requisicoes_edit': 'Editar Requisições',
    'requisicoes_delete': 'Apagar Requisições',
    'viaturas': 'Ver Viaturas',
    'motoristas': 'Ver Motoristas',
    'fornecedores': 'Gerir Fornecedores',
    'escalas': 'Ver Escalas',
    'escalas_create': 'Criar/Editar Escalas',
    'escalas_import': 'Importar Escalas',
    'escalas_print': 'Imprimir Escalas',
    'escalas_urgent': 'Pedidos Urgentes',
    'escalas_view_pending': 'Ver Pendentes',
    'horas': 'Registo de Horas',
    'hours_view_costs': 'Ver Custos Horas',
    'equipa-oficina': 'Equipa Oficina',
    'supervisores': 'Gerir Supervisores',
    'combustivel': 'Gestão Combustível',
    'combustivel_calibrate': 'Calibrar Tanque',
    'combustivel_edit_history': 'Editar Histórico Fuel',
    'central_motorista': 'Central Motorista',
    'centros_custos': 'Centros de Custos',
    'plataformas_externas': 'Plataformas Externas',
    'clientes': 'Gerir Clientes',
    'relatorios': 'Relatórios',
    'contabilidade': 'Contabilidade'
};

export default function UserFormModal({ isOpen, onClose, user, initialRole = 'motorista' }: UserFormModalProps) {
    const { permissions: defaultPermissions } = usePermissions();
    const { 
        addMotorista, updateMotorista, 
        addSupervisor, updateSupervisor,
        addOficinaUser, updateOficinaUser
    } = useWorkshop();

    const [role, setRole] = useState<UserRole>(initialRole);
    const [formData, setFormData] = useState<any>({
        nome: '',
        email: '',
        foto: '',
        status: 'active',
        // Specifics
        pin: '',
        password: '',
        telemovel: '',
        cartaConducao: '',
        vencimentoBase: 0,
        valorHora: 0,
        turnoInicio: '09:00',
        turnoFim: '18:00',
        folgas: [] as string[],
        blockedPermissions: [] as string[]
    });

    useEffect(() => {
        if (user) {
            setRole(user.role);
            setFormData({
                ...user,
                // Ensure array existence
                blockedPermissions: user.blockedPermissions || [],
                folgas: user.folgas || []
            });
        } else {
            // Reset
            setFormData({
                nome: '',
                email: '',
                foto: '',
                status: 'active',
                pin: '',
                password: '',
                telemovel: '',
                cartaConducao: '',
                vencimentoBase: 0,
                valorHora: 0,
                turnoInicio: '09:00',
                turnoFim: '18:00',
                folgas: [],
                blockedPermissions: []
            });
            setRole(initialRole);
        }
    }, [user, isOpen, initialRole]);

    if (!isOpen) return null;

    const availableModules = defaultPermissions[role === 'admin' ? 'supervisor' : role] || []; 
    
    const togglePermission = (module: string) => {
        setFormData((prev: any) => {
            const blocked = prev.blockedPermissions;
            if (blocked.includes(module)) {
                return { ...prev, blockedPermissions: blocked.filter((p: string) => p !== module) };
            } else {
                return { ...prev, blockedPermissions: [...blocked, module] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const baseData = {
            id: user?.id || crypto.randomUUID(),
            ...formData
        };

        try {
            if (role === 'motorista') {
                const driverData = {
                    id: baseData.id,
                    nome: baseData.nome,
                    email: baseData.email,
                    foto: baseData.foto,
                    contacto: baseData.telemovel, // mapped
                    cartaConducao: baseData.cartaConducao,
                    pin: baseData.pin,
                    vencimentoBase: Number(baseData.vencimentoBase),
                    valorHora: Number(baseData.valorHora),
                    turnoInicio: baseData.turnoInicio,
                    turnoFim: baseData.turnoFim,
                    folgas: baseData.folgas,
                    blockedPermissions: baseData.blockedPermissions,
                    status: (baseData.status === 'active' ? 'disponivel' : 'indisponivel') as any, // Cast to satisfy type
                    obs: baseData.obs || ''
                };
                if (user) await updateMotorista(driverData);
                else await addMotorista(driverData);

            } else if (role === 'supervisor') {
                const supData = {
                    id: baseData.id,
                    nome: baseData.nome,
                    email: baseData.email,
                    foto: baseData.foto,
                    telemovel: baseData.telemovel,
                    pin: baseData.pin,
                    password: baseData.password,
                    status: baseData.status === 'active' ? 'active' : 'blocked',
                    blockedPermissions: baseData.blockedPermissions
                };
                if (user) await updateSupervisor(supData as any);
                else await addSupervisor(supData as any);

            } else if (role === 'oficina') {
                const mechData = {
                    id: baseData.id,
                    nome: baseData.nome,
                    email: baseData.email,
                    foto: baseData.foto,
                    pin: baseData.pin,
                    status: baseData.status === 'active' ? 'active' : 'blocked',
                    blockedPermissions: baseData.blockedPermissions
                };
                if (user) await updateOficinaUser(mechData as any);
                else await addOficinaUser(mechData as any);
            } else if (role === 'admin') {
                alert('Criação de Admin deve ser feita via Supabase Auth diretamente por segurança.');
                // Placeholder
            }
            
            onClose();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao guardar: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {user ? 'Editar Utilizador' : 'Novo Utilizador'}
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase ml-2 border border-blue-500/30">
                            {role}
                        </span>
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Role Selector (Only on Created) */}
                    {!user && (
                        <div className="grid grid-cols-4 gap-4">
                            {['admin', 'motorista', 'oficina', 'supervisor'].map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r as UserRole)}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all capitalize
                                        ${role === r 
                                            ? 'bg-blue-600/20 border-blue-500 text-white' 
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    <span className="font-bold text-sm">{r}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                            <User className="w-4 h-4" /> Informações Pessoais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.nome}
                                    onChange={e => setFormData({...formData, nome: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                <input 
                                    type="email"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Foto URL</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.foto}
                                    onChange={e => setFormData({...formData, foto: e.target.value})}
                                    placeholder="https://"
                                />
                            </div>
                            {(role === 'supervisor' || role === 'motorista') && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Telemóvel</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.telemovel}
                                        onChange={e => setFormData({...formData, telemovel: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Credentials */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                            <Key className="w-4 h-4" /> Credenciais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">PIN de Acesso</label>
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.pin}
                                    onChange={e => setFormData({...formData, pin: e.target.value})}
                                    placeholder="0000"
                                    maxLength={6}
                                />
                            </div>
                            {role === 'supervisor' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                                    <input 
                                        type="password"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        placeholder="Min. 6 caracteres"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Driver Specifics */}
                    {role === 'motorista' && (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Dados Profissionais
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Vencimento Base</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.vencimentoBase}
                                        onChange={e => setFormData({...formData, vencimentoBase: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Valor Hora Extra</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.valorHora}
                                        onChange={e => setFormData({...formData, valorHora: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Carta Condução</label>
                                    <input 
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.cartaConducao}
                                        onChange={e => setFormData({...formData, cartaConducao: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 pt-2">
                                <Clock className="w-4 h-4" /> Turnos de Trabalho
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Início Turno</label>
                                    <input 
                                        type="time"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.turnoInicio}
                                        onChange={e => setFormData({...formData, turnoInicio: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Fim Turno</label>
                                    <input 
                                        type="time"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.turnoFim}
                                        onChange={e => setFormData({...formData, turnoFim: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Permissions */}
                    {role !== 'admin' && (
                        <div className="space-y-4 pt-4 border-t border-slate-800">
                             <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Permissões de Acesso
                            </h3>
                            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {availableModules.map(module => {
                                    const isBlocked = formData.blockedPermissions.includes(module);
                                    return (
                                        <label key={module} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors group">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                ${!isBlocked 
                                                    ? 'bg-blue-600 border-blue-500' 
                                                    : 'bg-slate-900 border-slate-600'
                                                }`}
                                            >
                                                {!isBlocked && <Save className="w-3 h-3 text-white" />} 
                                                {/* Reusing Save icon as Checkmark placeholder or use distinct icon */}
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                className="hidden" 
                                                checked={!isBlocked}
                                                onChange={() => togglePermission(module)}
                                            />
                                            <span className={`text-sm ${!isBlocked ? 'text-white' : 'text-slate-500'}`}>
                                                {PERMISSION_LABELS[module] || module}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500">
                                * Desmarque as opções para bloquear o acesso a módulos específicos para este utilizador.
                            </p>
                        </div>
                    )}

                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-400 hover:text-white transition-colors font-medium">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Gravar Utilizador
                    </button>
                </div>
            </div>
        </div>
    );
}
