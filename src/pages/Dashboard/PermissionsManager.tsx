import React, { useState } from 'react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule, RolePermissions } from '../../contexts/PermissionsContext';
import { Shield, Save, RotateCcw, Lock, Users, Wrench, User } from 'lucide-react';

const MODULES: { id: PermissionModule; label: string; category: string }[] = [
    // Operacional
    { id: 'requisicoes', label: 'Ver Requisições', category: 'Operacional' },
    { id: 'requisicoes_edit', label: 'Gerir Requisições', category: 'Operacional' },
    { id: 'requisicoes_delete', label: 'Apagar Requisições', category: 'Operacional' },
    { id: 'viaturas', label: 'Ver Viaturas', category: 'Operacional' },
    { id: 'combustivel', label: 'Ver Combustível', category: 'Operacional' },

    // Gestão
    { id: 'motoristas', label: 'Gerir Motoristas', category: 'Gestão' },
    { id: 'equipa-oficina', label: 'Gerir Equipa Oficina', category: 'Gestão' },
    { id: 'fornecedores', label: 'Gerir Fornecedores', category: 'Gestão' },
    { id: 'centros_custos', label: 'Centros de Custo', category: 'Gestão' },
    { id: 'contabilidade', label: 'Contabilidade', category: 'Gestão' },
    { id: 'supervisores', label: 'Gerir Supervisores', category: 'Gestão' },
    { id: 'clientes', label: 'Gerir Clientes', category: 'Gestão' },

    // Escalas e Horas
    { id: 'escalas', label: 'Ver Escalas', category: 'Escalas' },
    { id: 'escalas_create', label: 'Criar Escalas', category: 'Escalas' },
    { id: 'horas', label: 'Registo de Horas', category: 'Escalas' },
    { id: 'hours_view_costs', label: 'Ver Custos Horas', category: 'Escalas' },

    // Outros
    { id: 'plataformas_externas', label: 'Plat. Externas', category: 'Outros' },
    { id: 'central_motorista', label: 'Central Motorista', category: 'Outros' }
];

const ROLES = [
    { id: 'supervisor', label: 'Supervisor', icon: User },
    { id: 'motorista', label: 'Motorista', icon: Users },
    { id: 'oficina', label: 'Oficina', icon: Wrench },
] as const;

export default function PermissionsManager() {
    const { permissions, updatePermission } = usePermissions();
    const [activeRole, setActiveRole] = useState<'supervisor' | 'motorista' | 'oficina'>('supervisor');

    // Group modules by category
    const groupedModules = MODULES.reduce((acc, module) => {
        if (!acc[module.category]) acc[module.category] = [];
        acc[module.category].push(module);
        return acc;
    }, {} as Record<string, typeof MODULES>);

    const togglePermission = (module: PermissionModule) => {
        const currentRolePerms = permissions[activeRole];
        const hasAccess = currentRolePerms.includes(module);
        updatePermission(activeRole, module, !hasAccess);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-blue-400" />
                        Gestão de Permissões
                    </h2>
                    <p className="text-slate-600 text-sm mt-1">
                        Defina o que cada cargo pode ver e fazer na aplicação.
                    </p>
                </div>
            </div>

            {/* Role Selector */}
            <div className="flex p-1 bg-white rounded-xl border border-slate-200 shadow-sm">
                {ROLES.map(role => (
                    <button
                        key={role.id}
                        onClick={() => setActiveRole(role.id as any)}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all
                            ${activeRole === role.id
                                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }
                        `}
                    >
                        <role.icon className="w-4 h-4" />
                        {role.label}
                    </button>
                ))}
            </div>

            {/* Permissions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(groupedModules).map(([category, modules]) => (
                    <div key={category} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                            {category}
                        </h3>
                        <div className="space-y-3">
                            {modules.map(module => {
                                const isEnabled = permissions[activeRole]?.includes(module.id);
                                return (
                                    <div
                                        key={module.id}
                                        onClick={() => togglePermission(module.id)}
                                        className={`
                                            flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border
                                            ${isEnabled
                                                ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-full ${isEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                                {isEnabled ? <Shield className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className={`text-sm font-medium ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {module.label}
                                            </span>
                                        </div>

                                        <div className={`
                                            w-10 h-5 rounded-full relative transition-colors duration-300
                                            ${isEnabled ? 'bg-emerald-200' : 'bg-slate-300'}
                                        `}>
                                            <div className={`
                                                absolute top-1 w-3 h-3 rounded-full transition-all duration-300
                                                ${isEnabled ? 'bg-emerald-600 left-6' : 'bg-slate-500 left-1'}
                                            `} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-900">
                <RotateCcw className="w-5 h-5 flex-shrink-0 text-blue-400" />
                <p>
                    As alterações são gravadas automaticamente na tabela global de definições.
                    Os utilizadores poderão precisar de recarregar a página para verem as alterações.
                </p>
            </div>
        </div>
    );
}
