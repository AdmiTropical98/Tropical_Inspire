import React, { useState, useEffect } from 'react';
import {
    Shield, Wrench, Wallet, Car, MapPin, Users, MessageSquare, Save, CheckCircle2, XCircle, Info, Download, LayoutDashboard
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole, SystemModule, PermissionAction, DetailedPermissions } from '../../types';
import { supabase } from '../../lib/supabase';

const MODULES: { id: SystemModule; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'frota', label: 'Gestão de Frota', icon: Car },
    { id: 'escalas', label: 'Escalas e Operações', icon: MapPin },
    { id: 'horas', label: 'Registo de Horas', icon: Users },
    { id: 'combustivel', label: 'Combustível / Via Verde', icon: Wrench },
    { id: 'requisicoes', label: 'Requisições', icon: Download },
    { id: 'equipa', label: 'Gestão de Equipa', icon: Users },
    { id: 'financeiro', label: 'Financeiro e Custos', icon: Wallet },
    { id: 'relatorios', label: 'Relatórios e Audit', icon: Shield },
    { id: 'utilizadores', label: 'Utilizadores', icon: Users },
    { id: 'permissoes', label: 'Controlo de Acessos', icon: Shield },
    { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
    { id: 'configuracoes', label: 'Configurações', icon: Shield }
];

const ACTIONS: { id: PermissionAction; label: string }[] = [
    { id: 'ver', label: 'Ver' },
    { id: 'criar', label: 'Criar' },
    { id: 'editar', label: 'Editar' },
    { id: 'eliminar', label: 'Eliminar' },
    { id: 'exportar', label: 'Exportar' },
    { id: 'aprovar', label: 'Aprovar' }
];

export default function Permissoes() {
    const { roleDefaults } = usePermissions();
    const { userRole, currentUser } = useAuth();

    const [selectedRole, setSelectedRole] = useState<UserRole>('GESTOR');
    const [localPerms, setLocalPerms] = useState<DetailedPermissions>({});
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [showDoubleConfirm, setShowDoubleConfirm] = useState(false);

    // Sync local state when role changes or defaults are loaded
    useEffect(() => {
        if (roleDefaults[selectedRole]) {
            setLocalPerms(JSON.parse(JSON.stringify(roleDefaults[selectedRole])));
            setHasChanges(false);
        }
    }, [selectedRole, roleDefaults]);

    if (userRole !== 'ADMIN_MASTER') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <Shield className="w-16 h-16 text-red-500/50 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
                <p className="text-slate-400 max-w-md">
                    Apenas o <strong>ADMIN_MASTER</strong> tem permissão para alterar as definições globais de acesso do sistema.
                </p>
            </div>
        );
    }

    const handleToggle = (module: SystemModule, action: PermissionAction) => {
        setLocalPerms(prev => {
            const modulePerms = prev[module] || [];
            let newModulePerms: PermissionAction[] = [];

            if (modulePerms.includes(action)) {
                newModulePerms = modulePerms.filter(a => a !== action);
            } else {
                newModulePerms = [...modulePerms, action];
            }

            return { ...prev, [module]: newModulePerms };
        });
        setHasChanges(true);
    };

    const applyQuickAction = (type: 'all' | 'read' | 'none') => {
        const newPerms: DetailedPermissions = {};
        MODULES.forEach(m => {
            if (type === 'all') newPerms[m.id] = ['ver', 'criar', 'editar', 'eliminar', 'exportar', 'aprovar'];
            else if (type === 'read') newPerms[m.id] = ['ver'];
            else newPerms[m.id] = [];
        });
        setLocalPerms(newPerms);
        setHasChanges(true);
    };

    const handleApplyAll = (module: SystemModule, type: 'full' | 'read' | 'none') => {
        setLocalPerms(prev => ({
            ...prev,
            [module]: type === 'full'
                ? ['ver', 'criar', 'editar', 'eliminar', 'exportar', 'aprovar']
                : type === 'read' ? ['ver'] : []
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setShowDoubleConfirm(true);
    };

    const confirmSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('role_permissions_defaults')
                .update({ permissions: localPerms, updated_at: new Date().toISOString() })
                .eq('role', selectedRole);

            if (error) throw error;

            // Audit Log
            await supabase.from('audit_logs').insert({
                action: 'UPDATE_ROLE_DEFAULTS',
                performed_by: currentUser?.id,
                details: { role: selectedRole, permissions: localPerms }
            });

            alert('Permissões padrão para ' + selectedRole + ' atualizadas successfully!');
            setHasChanges(false);
            setShowDoubleConfirm(false);
        } catch (error: any) {
            alert('Erro ao guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0f172a] overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-slate-900/50 border-b border-slate-800 backdrop-blur-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-blue-500" />
                            Controlo Total de Permissões
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Configure os acessos padrão para cada perfil de utilizador.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <button
                                onClick={() => setHasChanges(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${hasChanges
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'A guardar...' : 'Guardar Configuração'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Role Selection Tabs */}
            <div className="flex p-4 gap-2 bg-slate-900/30 overflow-x-auto border-b border-slate-800 no-scrollbar">
                {(['ADMIN', 'GESTOR', 'SUPERVISOR', 'OFICINA', 'MOTORISTA'] as UserRole[]).map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`flex-shrink-0 px-6 py-2 rounded-lg font-bold transition-all border ${selectedRole === role
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                            }`}
                    >
                        {role}
                    </button>
                ))}
            </div>

            {/* Quick Actions Bar */}
            <div className="p-4 bg-slate-900/20 flex flex-wrap items-center gap-4 text-sm border-b border-slate-800">
                <span className="text-slate-500 uppercase font-bold text-xs tracking-wider">Ações Rápidas (Padrão):</span>
                <button onClick={() => applyQuickAction('all')} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-all">Acesso Total</button>
                <button onClick={() => applyQuickAction('read')} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-all">Apenas Leitura</button>
                <button onClick={() => applyQuickAction('none')} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all">Sem Acesso</button>
            </div>

            {/* Permissions Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-800">
                                <th className="p-4 text-slate-300 font-bold">Módulo do Sistema</th>
                                {ACTIONS.map(action => (
                                    <th key={action.id} className="p-4 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">{action.label}</th>
                                ))}
                                <th className="p-4 text-center text-slate-500 text-xs">Rápido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {MODULES.map(module => {
                                const modulePerms = localPerms[module.id] || [];
                                const ModuleIcon = module.icon;

                                return (
                                    <tr key={module.id} className="hover:bg-slate-800/20 transition-all group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-all">
                                                    <ModuleIcon className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{module.label}</span>
                                            </div>
                                        </td>

                                        {ACTIONS.map(action => {
                                            const isEnabled = modulePerms.includes(action.id);
                                            return (
                                                <td key={action.id} className="p-4 text-center">
                                                    <button
                                                        onClick={() => handleToggle(module.id, action.id)}
                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isEnabled
                                                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                                                                : 'bg-slate-800/50 text-slate-600 border border-slate-700/50 hover:border-slate-600'
                                                            }`}
                                                    >
                                                        {isEnabled ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5 opacity-30" />}
                                                    </button>
                                                </td>
                                            );
                                        })}

                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleApplyAll(module.id, 'full')} className="p-1.5 hover:bg-slate-800 rounded text-[10px] text-slate-500 hover:text-white transition-colors">T</button>
                                                <button onClick={() => handleApplyAll(module.id, 'none')} className="p-1.5 hover:bg-slate-800 rounded text-[10px] text-slate-500 hover:text-white transition-colors">0</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-4 items-start">
                    <Info className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <div>
                        <h4 className="text-blue-400 font-bold mb-1">Nota de Segurança</h4>
                        <p className="text-sm text-blue-300 opacity-70 leading-relaxed">
                            Estas permissões são aplicadas automaticamente a novos utilizadores criados com este perfil.
                            Alterações feitas aqui <strong>não afetam</strong> utilizadores existentes que tenham permissões ajustadas individualmente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Double Confirmation Modal */}
            {showDoubleConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-8 h-8 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white text-center mb-4">Confirmar Alteração</h2>
                        <p className="text-slate-400 text-center mb-8 leading-relaxed">
                            Está prestes a alterar as permissões padrão para o perfil <strong className="text-white">{selectedRole}</strong>.
                            Esta ação será registada no sistema de auditoria. Deseja continuar?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmSave}
                                disabled={isSaving}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all"
                            >
                                {isSaving ? 'A Processar...' : 'Sim, Aplicar Alterações'}
                            </button>
                            <button
                                onClick={() => setShowDoubleConfirm(false)}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
