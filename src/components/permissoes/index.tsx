import { useState } from 'react';
import { Shield, User, Lock, Unlock, Wrench, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { PermissionModule } from '../../contexts/PermissionsContext';
import { useTranslation } from '../../hooks/useTranslation';

interface PermissionGroup {
    id: string;
    labelKey: string;
    permissions: {
        id: PermissionModule;
        labelKey: string;
    }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'requisicoes',
        labelKey: 'menu.requisitions',
        permissions: [
            { id: 'requisicoes', labelKey: 'menu.requisitions' },
            { id: 'requisicoes_edit', labelKey: 'permission.edit' },
            { id: 'requisicoes_delete', labelKey: 'permission.delete' },
        ]
    },
    {
        id: 'viaturas',
        labelKey: 'menu.vehicles',
        permissions: [{ id: 'viaturas', labelKey: 'menu.vehicles' }]
    },
    {
        id: 'motoristas',
        labelKey: 'menu.drivers',
        permissions: [{ id: 'motoristas', labelKey: 'menu.drivers' }]
    },
    {
        id: 'fornecedores',
        labelKey: 'menu.suppliers',
        permissions: [{ id: 'fornecedores', labelKey: 'menu.suppliers' }]
    },
    {
        id: 'equipa-oficina',
        labelKey: 'menu.workshop_team',
        permissions: [{ id: 'equipa-oficina', labelKey: 'menu.workshop_team' }]
    },
    {
        id: 'supervisores',
        labelKey: 'menu.supervisors',
        permissions: [{ id: 'supervisores', labelKey: 'menu.supervisors' }]
    },
    {
        id: 'escalas',
        labelKey: 'menu.schedule',
        permissions: [
            { id: 'escalas', labelKey: 'menu.schedule' },
            { id: 'escalas_import', labelKey: 'schedule.action.import' },
            { id: 'escalas_print', labelKey: 'schedule.action.pdf' },
            { id: 'escalas_create', labelKey: 'schedule.action.manual' },
            { id: 'escalas_urgent', labelKey: 'schedule.action.urgent' },
            { id: 'escalas_view_pending', labelKey: 'schedule.action.pending' },
        ]
    },
    {
        id: 'horas',
        labelKey: 'menu.hours',
        permissions: [
            { id: 'horas', labelKey: 'menu.hours' },
            { id: 'hours_view_costs', labelKey: 'hours.view_costs' }
        ]
    },
    {
        id: 'combustivel',
        labelKey: 'menu.fuel',
        permissions: [
            { id: 'combustivel', labelKey: 'menu.fuel' },
            { id: 'combustivel_calibrate', labelKey: 'fuel.entry.calibrate' },
            { id: 'combustivel_edit_history', labelKey: 'fuel.action.history' }
        ]
    }
];

export default function Permissoes() {
    const { permissions, updatePermission } = usePermissions();
    const { t } = useTranslation();

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const togglePermission = (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule) => {
        const hasAccess = permissions[role].includes(module);
        updatePermission(role, module, !hasAccess);
    };

    const renderRoleColumn = (role: 'supervisor' | 'motorista' | 'oficina', icon: React.ReactNode, title: string, desc: string, colorClass: string, bgClass: string, borderClass: string) => (
        <div className={`bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden group hover:${borderClass} transition-all duration-300`}>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center border ${borderClass} bg-opacity-10 border-opacity-20`}>
                    {icon}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <p className="text-xs text-slate-400">{desc}</p>
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                {PERMISSION_GROUPS.map((group) => {
                    const isExpanded = expandedGroups[`${role}-${group.id}`];
                    // Clean check: does role have MAIN permission of this group?
                    // Usually the first one is the main one.
                    const mainPermissionId = group.permissions[0].id;
                    const hasMainAccess = permissions[role].includes(mainPermissionId);

                    return (
                        <div key={group.id} className={`rounded-xl border ${hasMainAccess ? 'border-slate-700 bg-slate-800/20' : 'border-slate-800 bg-slate-900/20'} overflow-hidden transition-all duration-200`}>
                            <button
                                onClick={() => group.permissions.length > 1 ? toggleGroup(`${role}-${group.id}`) : togglePermission(role, group.permissions[0].id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {group.permissions.length > 1 && (
                                        <div onClick={(e) => { e.stopPropagation(); toggleGroup(`${role}-${group.id}`); }} className="p-1 hover:bg-slate-700 rounded cursor-pointer">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                        </div>
                                    )}
                                    <span className={`text-sm font-bold ${hasMainAccess ? 'text-white' : 'text-slate-500'}`}>
                                        {t(group.labelKey)}
                                    </span>
                                </div>

                                {/* If single permission, show toggle directly. If multiple, show status summary or toggle main */}
                                {group.permissions.length === 1 ? (
                                    <div onClick={(e) => { e.stopPropagation(); togglePermission(role, group.permissions[0].id); }} className="cursor-pointer">
                                        {hasMainAccess ? <Unlock className={`w-4 h-4 ${colorClass}`} /> : <Lock className="w-4 h-4 text-slate-600" />}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {group.permissions.filter(p => permissions[role].includes(p.id)).length}/{group.permissions.length}
                                        </span>
                                    </div>
                                )}
                            </button>

                            {/* Expanded Sub-Permissions */}
                            {group.permissions.length > 1 && isExpanded && (
                                <div className="border-t border-slate-800 bg-black/20 p-2 space-y-1">
                                    {group.permissions.map(perm => {
                                        const isActive = permissions[role].includes(perm.id);
                                        return (
                                            <button
                                                key={perm.id}
                                                onClick={() => togglePermission(role, perm.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${isActive ? 'bg-slate-700/50 text-slate-200' : 'text-slate-500 hover:bg-slate-800/30'}`}
                                            >
                                                <span>{perm.id === 'hours_view_costs' ? 'Ver Custos/Valores' : t(perm.labelKey)}</span>
                                                {isActive && <Check className={`w-3 h-3 ${colorClass}`} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">{t('permissions.title')}</h1>
                <p className="text-slate-400">{t('permissions.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {renderRoleColumn('supervisor', <Shield className="w-5 h-5 text-purple-400" />, t('permissions.role.supervisor'), t('permissions.role.supervisor_desc'), 'text-purple-400', 'bg-purple-500', 'border-purple-500')}
                {renderRoleColumn('oficina', <Wrench className="w-5 h-5 text-orange-400" />, t('permissions.role.workshop'), t('permissions.role.workshop_desc'), 'text-orange-400', 'bg-orange-500', 'border-orange-500')}
                {renderRoleColumn('motorista', <User className="w-5 h-5 text-emerald-400" />, t('permissions.role.driver'), t('permissions.role.driver_desc'), 'text-emerald-400', 'bg-emerald-500', 'border-emerald-500')}
            </div>
        </div>
    );
}
