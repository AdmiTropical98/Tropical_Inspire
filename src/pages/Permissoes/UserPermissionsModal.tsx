import { useState, useEffect } from 'react';
import { X, Shield, CheckCircle2, XCircle, Info, Save } from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { SystemModule, PermissionAction, DetailedPermissions, UserRole } from '../../types';

interface UserPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any; // UserProfile or similar
    onSave: () => void;
}

const MODULES: { id: SystemModule; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'frota', label: 'Gestão de Frota' },
    { id: 'escalas', label: 'Escalas e Operações' },
    { id: 'horas', label: 'Registo de Horas' },
    { id: 'combustivel', label: 'Combustível / Via Verde' },
    { id: 'requisicoes', label: 'Requisições' },
    { id: 'equipa', label: 'Gestão de Equipa' },
    { id: 'financeiro', label: 'Financeiro e Custos' },
    { id: 'relatorios', label: 'Relatórios e Audit' },
    { id: 'utilizadores', label: 'Gestão de Utilizadores' },
    { id: 'permissoes', label: 'Controlo de Acessos' },
    { id: 'mensagens', label: 'Mensagens' },
    { id: 'configuracoes', label: 'Configurações' }
];

const ACTIONS: { id: PermissionAction; label: string }[] = [
    { id: 'ver', label: 'V' }, // Short labels for modal grid
    { id: 'criar', label: 'C' },
    { id: 'editar', label: 'E' },
    { id: 'eliminar', label: 'X' },
    { id: 'exportar', label: 'Ex' },
    { id: 'aprovar', label: 'Ap' }
];

export default function UserPermissionsModal({ isOpen, onClose, user, onSave }: UserPermissionsModalProps) {
    const { roleDefaults } = usePermissions();
    const [localPerms, setLocalPerms] = useState<DetailedPermissions>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            // If user has no permissions, use role defaults as starting point
            const basePerms = user.permissions || roleDefaults[user.role as UserRole] || {};
            setLocalPerms(JSON.parse(JSON.stringify(basePerms)));
        }
    }, [isOpen, user, roleDefaults]);

    if (!isOpen || !user) return null;

    const handleToggle = (module: SystemModule, action: PermissionAction) => {
        const modulePerms = localPerms[module] || [];
        let newModulePerms: PermissionAction[] = [];

        if (modulePerms.includes(action)) {
            newModulePerms = modulePerms.filter(a => a !== action);
        } else {
            newModulePerms = [...modulePerms, action];
        }

        setLocalPerms(prev => ({ ...prev, [module]: newModulePerms }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { supabase } = await import('../../lib/supabase');
            const { error } = await supabase
                .from('user_profiles')
                .update({ permissions: localPerms })
                .eq('id', user.id);

            if (error) throw error;

            // Audit
            await supabase.from('audit_logs').insert({
                action: 'UPDATE_USER_PERMISSIONS_OVERRIDE',
                target_id: user.id,
                details: { old_perms: user.permissions, new_perms: localPerms }
            });

            onSave();
            onClose();
        } catch (error: any) {
            alert('Erro ao guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const inheritsFromDefaults = !user.permissions;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-[#1e293b] w-full max-w-4xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-400" />
                            Ajuste de Permissões Individuais
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Utilizador: <span className="text-white font-medium">{user.nome}</span> | Perfil: <span className="text-blue-400">{user.role}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Info Alert */}
                <div className="mx-6 mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <p className="text-xs text-blue-300 leading-relaxed">
                        Ao alterar qualquer permissão aqui, este utilizador passará a ter um <strong>conjunto personalizado</strong> de acessos.
                    </p>
                </div>

                {/* Custom Permissions Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/80 border-b border-slate-800">
                                    <th className="p-4 text-slate-300 font-bold text-sm">Módulo</th>
                                    {ACTIONS.map(action => (
                                        <th key={action.id} className="p-4 text-center text-slate-500 font-bold text-xs" title={action.id}>{action.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {MODULES.map(module => {
                                    const modulePerms = localPerms[module.id] || [];
                                    return (
                                        <tr key={module.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4">
                                                <span className="text-sm font-medium text-slate-200">{module.label}</span>
                                            </td>
                                            {ACTIONS.map(action => {
                                                const isEnabled = modulePerms.includes(action.id);
                                                return (
                                                    <td key={action.id} className="p-2 text-center">
                                                        <button
                                                            onClick={() => handleToggle(module.id, action.id)}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isEnabled
                                                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                                                                    : 'bg-slate-800 text-slate-600 border border-slate-700/50'
                                                                }`}
                                                        >
                                                            {isEnabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 opacity-20" />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-between items-center">
                    <div className="text-xs text-slate-500 italic">
                        {inheritsFromDefaults ? 'A herdar do perfil base' : 'Personalização ativa'}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'A guardar...' : 'Guardar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
