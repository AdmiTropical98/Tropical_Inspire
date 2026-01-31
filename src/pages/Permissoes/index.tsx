import React, { useState, useEffect } from 'react';
import {
    Shield, Wrench, Wallet, Car, MapPin, Users, MessageSquare,
    User, UserCheck, LayoutDashboard, Save
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule, RolePermissions } from '../../contexts/PermissionsContext';


interface PermissionGroup {
    id: string;
    labelKey: string;
    icon: React.ElementType;
    descriptionKey?: string;
    permissions: {
        id: PermissionModule;
        labelKey: string;
        descriptionKey?: string;
    }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'dashboard',
        labelKey: 'Dashboard', // Hardcoded as per request
        icon: LayoutDashboard,
        permissions: [
            { id: 'dashboard', labelKey: 'Dashboard' }
        ]
    },
    {
        id: 'fleet',
        labelKey: 'Gestão de Frota',
        icon: Car,
        permissions: [
            { id: 'central_motorista', labelKey: 'Central Motorista' },
            { id: 'viaturas', labelKey: 'Viaturas' },
            { id: 'geofences', labelKey: 'Geofences' },
            { id: 'locais', labelKey: 'POIs' }, // Renamed from Locais to POIs
            { id: 'avaliacao', labelKey: 'Avaliação Drivers' } // Renamed
        ]
    },
    {
        id: 'operations',
        labelKey: 'Operações',
        icon: MapPin,
        permissions: [
            { id: 'escalas', labelKey: 'Escalas' },
            { id: 'escalas_create', labelKey: 'Lançar Escalas' },
            { id: 'horas', labelKey: 'Registro de Horas' }, // Renamed
            { id: 'plataformas_externas', labelKey: 'Transportes EVA' }
        ]
    },
    {
        id: 'workshop',
        labelKey: 'Oficina',
        icon: Wrench,
        permissions: [
            { id: 'combustivel', labelKey: 'Combustível' },
            { id: 'requisicoes', labelKey: 'Requisições' }
        ]
    },
    {
        id: 'team',
        labelKey: 'Equipa',
        icon: Users,
        permissions: [
            { id: 'gestores', labelKey: 'Gestores' },
            { id: 'equipa-oficina', labelKey: 'Equipa Oficina' },
            { id: 'supervisores', labelKey: 'Supervisores' },
            { id: 'motoristas', labelKey: 'Motoristas' }
        ]
    },
    {
        id: 'financial',
        labelKey: 'Financeiro',
        icon: Wallet,
        permissions: [
            { id: 'contabilidade', labelKey: 'Contabilidade' },
            { id: 'centros_custos', labelKey: 'Centro de Custos' },
            { id: 'fornecedores', labelKey: 'Fornecedores' },
            { id: 'clientes', labelKey: 'Clientes' },
            { id: 'relatorios', labelKey: 'Relatórios' }
        ]
    },
    {
        id: 'communication',
        labelKey: 'Comunicação',
        icon: MessageSquare,
        permissions: [
            { id: 'mensagens', labelKey: 'Mensagens' }
        ]
    }
];

export default function Permissoes() {
    const { permissions: contextPermissions, saveAllPermissions } = usePermissions();
    const [localPermissions, setLocalPermissions] = useState<RolePermissions>(contextPermissions);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync with context on load
    useEffect(() => {
        setLocalPermissions(contextPermissions);
        setHasChanges(false);
    }, [contextPermissions]);

    const togglePermission = (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', module: PermissionModule) => {
        setLocalPermissions(prev => {
            const currentRolePerms = prev[role];
            const hasAccess = currentRolePerms.includes(module);

            const newRolePerms = hasAccess
                ? currentRolePerms.filter(p => p !== module)
                : [...currentRolePerms, module];

            return {
                ...prev,
                [role]: newRolePerms
            };
        });
        setHasChanges(true);
    };

    const toggleGroupPermission = (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', group: PermissionGroup) => {
        setLocalPermissions(prev => {
            const currentRolePerms = prev[role];
            const allEnabled = group.permissions.every(p => currentRolePerms.includes(p.id));
            const shouldEnable = !allEnabled;

            let newRolePerms = [...currentRolePerms];

            group.permissions.forEach(p => {
                if (shouldEnable) {
                    if (!newRolePerms.includes(p.id)) {
                        newRolePerms.push(p.id);
                    }
                } else {
                    newRolePerms = newRolePerms.filter(id => id !== p.id);
                }
            });

            return {
                ...prev,
                [role]: newRolePerms
            };
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveAllPermissions(localPermissions);
            setHasChanges(false);
            alert('Permissões gravadas com sucesso!'); // Using simple alert for now
        } catch (error) {
            alert('Erro ao gravar permissões. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 w-full var-scroll-container overflow-y-auto custom-scrollbar p-4 md:p-6 pb-24 space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        Gestão de Permissões
                    </h1>
                    <p className="text-slate-400 max-w-2xl">
                        Gerencie os níveis de acesso de cada função no sistema.
                    </p>
                </div>
                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg ${hasChanges
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20 translate-y-0 opacity-100'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                        }`}
                >
                    <Save className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'Gravando...' : 'Gravar Alterações'}
                </button>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-6">
                {PERMISSION_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                        <div key={group.id} className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl overflow-hidden p-4">
                            {/* Group Header */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                        <GroupIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">{group.labelKey}</h3>
                                </div>
                            </div>

                            {/* Group Toggles (Mobile) */}
                            <div className="mb-4 bg-slate-800/30 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selecionar Tudo</span>
                                <div className="flex gap-2">
                                    {(['supervisor', 'oficina', 'motorista', 'gestor'] as const).map((role) => {
                                        const allEnabled = group.permissions.every(p => localPermissions[role].includes(p.id));

                                        return (
                                            <button
                                                key={`group-mobile-${role}-${group.id}`}
                                                onClick={() => toggleGroupPermission(role, group)}
                                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${allEnabled
                                                    ? (role === 'supervisor' ? 'bg-purple-500' : role === 'oficina' ? 'bg-orange-500' : role === 'gestor' ? 'bg-cyan-500' : 'bg-emerald-500')
                                                    : 'bg-slate-700 hover:bg-slate-600'
                                                    }`}
                                                title={`Alternar ${group.labelKey} para ${role}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${allEnabled ? 'bg-white' : 'bg-slate-400'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>


                            {/* Permissions List */}
                            <div className="space-y-6">
                                {group.permissions.map((perm) => (
                                    <div key={perm.id} className="space-y-3">
                                        <div className="font-medium text-slate-200">{perm.labelKey}</div>

                                        {/* Toggles Grid */}
                                        <div className="grid grid-cols-4 gap-2">
                                            {(['supervisor', 'oficina', 'motorista', 'gestor'] as const).map((role) => {
                                                const isActive = localPermissions[role].includes(perm.id);
                                                const roleLabel = role === 'supervisor' ? 'Sup' : role === 'oficina' ? 'Ofc' : role === 'motorista' ? 'Mot' : 'Ges';

                                                const activeColor = role === 'supervisor' ? 'bg-purple-500' : role === 'oficina' ? 'bg-orange-500' : role === 'gestor' ? 'bg-cyan-500' : 'bg-emerald-500';
                                                const activeText = role === 'supervisor' ? 'text-purple-400' : role === 'oficina' ? 'text-orange-400' : role === 'gestor' ? 'text-cyan-400' : 'text-emerald-400';

                                                return (
                                                    <div key={`${role}-${perm.id}`} className="flex flex-col items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                                        <span className={`text-[10px] font-bold uppercase ${activeText}`}>
                                                            {roleLabel}
                                                        </span>
                                                        <button
                                                            onClick={() => togglePermission(role, perm.id)}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none ${isActive ? activeColor : 'bg-slate-700'}`}
                                                        >
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700">
                                <th className="px-6 py-5 text-slate-300 font-bold w-1/3">Módulo de Acesso</th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-2">
                                            <Shield className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <span className="text-purple-400 font-bold text-sm">Supervisor</span>
                                    </div>
                                </th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 mb-2">
                                            <Wrench className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <span className="text-orange-400 font-bold text-sm">Oficina</span>
                                    </div>
                                </th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
                                            <User className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <span className="text-emerald-400 font-bold text-sm">Motorista</span>
                                    </div>
                                </th>
                                <th className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-2">
                                            <UserCheck className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <span className="text-cyan-400 font-bold text-sm">Gestor</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {PERMISSION_GROUPS.map((group) => {
                                const GroupIcon = group.icon;
                                return (
                                    <>
                                        {/* Group Header */}
                                        <tr key={`header-${group.id}`} className="bg-slate-800/30 border-t border-slate-700/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                                        <GroupIcon className="w-4 h-4 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                                                            {group.labelKey}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Group Select All Toggles */}
                                            {(['supervisor', 'oficina', 'motorista', 'gestor'] as const).map((role) => {
                                                const allEnabled = group.permissions.every(p => localPermissions[role].includes(p.id));
                                                return (
                                                    <td key={`group-toggle-${role}-${group.id}`} className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => toggleGroupPermission(role, group)}
                                                            className={`text-xs font-bold px-2 py-1 rounded transition-colors ${allEnabled ? 'text-white bg-white/10 hover:bg-white/20' : 'text-slate-500 hover:text-slate-300'
                                                                }`}
                                                        >
                                                            {allEnabled ? 'Todos' : 'Selecionar'}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>

                                        {/* Sub Permissions */}
                                        {group.permissions.map((perm) => (
                                            <tr key={perm.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4 pl-16">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                                                            {perm.labelKey}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Role Toggles */}
                                                {(['supervisor', 'oficina', 'motorista', 'gestor'] as const).map((role) => {
                                                    const isActive = localPermissions[role].includes(perm.id);
                                                    const colorClass = role === 'supervisor' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                                        : role === 'oficina' ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                                                            : role === 'gestor' ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                                                                : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';

                                                    const ringClass = role === 'supervisor' ? 'focus:ring-purple-500'
                                                        : role === 'oficina' ? 'focus:ring-orange-500'
                                                            : role === 'gestor' ? 'focus:ring-cyan-500'
                                                                : 'focus:ring-emerald-500';

                                                    return (
                                                        <td key={`${role}-${perm.id}`} className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => togglePermission(role, perm.id)}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${isActive ? colorClass : 'bg-slate-700'
                                                                    } ${ringClass}`}
                                                            >
                                                                <span
                                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-1'
                                                                        }`}
                                                                />
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
