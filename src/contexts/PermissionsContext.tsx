import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

import type { UserRole, SystemModule, PermissionAction, DetailedPermissions, UserProfile } from '../types';

export type PermissionModule = 'requisicoes' | 'requisicoes_edit' | 'requisicoes_delete' |
    'viaturas' |
    'motoristas' |
    'fornecedores' |
    'escalas' | 'escalas_import' | 'escalas_print' | 'escalas_create' | 'escalas_urgent' | 'escalas_view_pending' |
    'horas' | 'hours_view_costs' |
    'equipa-oficina' |
    'supervisores' |
    'combustivel' | 'combustivel_calibrate' | 'combustivel_edit_history' | 'combustivel_edit' | 'combustivel_delete' |
    'central_motorista' | 'central_navegacao' | 'central_recibos' |
    'centros_custos' |
    'plataformas_externas' |
    'clientes' |
    'relatorios' |
    'contabilidade' |
    'dashboard' |
    'mensagens' |
    'geofences' |
    'locais' |
    'gestores' |
    'avaliacao_drivers' |
    'roteirizacao' |
    'via_verde';

export interface RolePermissions {
    supervisor: PermissionModule[];
    motorista: PermissionModule[];
    oficina: PermissionModule[];
    gestor: PermissionModule[];
}

interface PermissionsContextType {
    permissions: RolePermissions; // Legacy permissions
    roleDefaults: Record<UserRole, DetailedPermissions>; // Granular defaults
    updatePermission: (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', module: PermissionModule, hasAccess: boolean) => void;
    saveAllPermissions: (newPermissions: RolePermissions) => Promise<void>;
    hasAccess: (role: UserRole | string | null, module: SystemModule | PermissionModule, action?: PermissionAction) => boolean;
    updateGranularPermission: (userId: string, module: SystemModule, action: PermissionAction, hasAccess: boolean) => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// Default permissions configuration
const DEFAULT_PERMISSIONS: RolePermissions = {
    supervisor: [
        'requisicoes', 'requisicoes_edit', 'requisicoes_delete',
        'viaturas',
        'motoristas',
        'fornecedores',
        'escalas', 'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
        'horas', 'hours_view_costs',
        'equipa-oficina',
        'combustivel', 'combustivel_calibrate', 'combustivel_edit_history',
        'centros_custos',
        'plataformas_externas',
        'relatorios',
        'contabilidade',
        'dashboard',
        'mensagens',
        'geofences',
        'locais', 'avaliacao_drivers',
        'central_navegacao', 'central_recibos'
    ],
    motorista: [
        'requisicoes', 'requisicoes_edit', 'requisicoes_delete', // Allow blocking if granted
        'viaturas',
        'motoristas',
        'fornecedores',
        'escalas', 'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
        'horas', 'hours_view_costs',
        'equipa-oficina',
        'combustivel', 'combustivel_calibrate', 'combustivel_edit_history',
        'central_motorista',
        // 'central_navegacao', 'central_recibos', // EXCLUDED BY DEFAULT
        'centros_custos',
        'plataformas_externas',
        'dashboard',
        'mensagens',
        'geofences'
    ],
    oficina: [
        'viaturas',
        'requisicoes', 'requisicoes_edit', 'requisicoes_delete',
        'combustivel', 'combustivel_calibrate', 'combustivel_edit_history',
        'centros_custos',
        'escalas', 'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
        'horas', 'hours_view_costs',
        'motoristas', 'fornecedores', 'equipa-oficina', 'plataformas_externas',
        'supervisores', 'clientes', 'relatorios',
        'dashboard', 'mensagens', 'geofences',
        'locais', 'avaliacao_drivers'
    ],
    gestor: [
        'requisicoes', 'requisicoes_edit', 'requisicoes_delete',
        'viaturas',
        'motoristas',
        'fornecedores',
        'escalas', 'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
        'horas', 'hours_view_costs',
        'equipa-oficina',
        'combustivel', 'combustivel_calibrate', 'combustivel_edit_history',
        'centros_custos',
        'plataformas_externas',
        'relatorios',
        'contabilidade',
        'dashboard',
        'mensagens',
        'geofences',
        'supervisores',
        'clientes',
        'locais', 'avaliacao_drivers'
    ]
};

// Helper to map legacy modules to new granular system
const LEGACY_MAP: Record<string, { module: SystemModule, action: PermissionAction }> = {
    'requisicoes': { module: 'requisicoes', action: 'ver' },
    'requisicoes_edit': { module: 'requisicoes', action: 'editar' },
    'requisicoes_delete': { module: 'requisicoes', action: 'eliminar' },
    'viaturas': { module: 'frota', action: 'ver' },
    'motoristas': { module: 'frota', action: 'ver' },
    'escalas': { module: 'escalas', action: 'ver' },
    'escalas_create': { module: 'escalas', action: 'criar' },
    'combustivel': { module: 'combustivel', action: 'ver' },
    'combustivel_edit': { module: 'combustivel', action: 'editar' },
    'horas': { module: 'horas', action: 'ver' },
    'dashboard': { module: 'dashboard', action: 'ver' },
    'mensagens': { module: 'mensagens', action: 'ver' },
    'relatorios': { module: 'relatorios', action: 'ver' },
    'centros_custos': { module: 'financeiro', action: 'ver' },
    'contabilidade': { module: 'financeiro', action: 'ver' },
    'geofences': { module: 'frota', action: 'ver' },
    'locais': { module: 'frota', action: 'ver' },
    'avaliacao_drivers': { module: 'frota', action: 'ver' },
    'supervisores': { module: 'utilizadores', action: 'ver' },
    'gestores': { module: 'utilizadores', action: 'ver' },
    'configuracoes': { module: 'configuracoes', action: 'ver' },
    'permissoes': { module: 'permissoes', action: 'ver' },
    'oficina': { module: 'oficina', action: 'ver' },
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { currentUser, refreshCurrentUser } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
    const [roleDefaults, setRoleDefaults] = useState<Record<UserRole, DetailedPermissions>>({} as any);

    // Initial Fetch from DB and Realtime Subscription
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                // 1. Fetch Legacy Permissions (individual role settings)
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['permissions_supervisor', 'permissions_motorista', 'permissions_oficina', 'permissions_gestor']);

                if (error) {
                    console.error('Error fetching legacy permissions:', error);
                    // Continue to fetch granular defaults even if legacy fails
                }

                if (data && data.length > 0) {
                    setPermissions(prev => {
                        const nextPerms = { ...prev };
                        data.forEach((item: any) => {
                            if (item.key === 'permissions_supervisor' && Array.isArray(item.value)) {
                                nextPerms.supervisor = item.value;
                            }
                            if (item.key === 'permissions_motorista' && Array.isArray(item.value)) {
                                nextPerms.motorista = item.value;
                            }
                            if (item.key === 'permissions_oficina' && Array.isArray(item.value)) {
                                nextPerms.oficina = item.value;
                            }
                            if (item.key === 'permissions_gestor' && Array.isArray(item.value)) {
                                nextPerms.gestor = item.value;
                            }
                        });
                        return nextPerms;
                    });
                }

                // 2. Fetch Granular Defaults
                const { data: defaultsData } = await supabase.from('role_permissions_defaults').select('*');
                if (defaultsData) {
                    const defaultsMap: any = {};
                    defaultsData.forEach(d => {
                        defaultsMap[d.role] = d.permissions;
                    });
                    setRoleDefaults(defaultsMap);
                }
            } catch (err) {
                console.error('Unexpected error fetching permissions:', err);
            }
        };

        fetchPermissions();

        // Realtime subscription
        const channel = supabase
            .channel('permissions_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'app_settings',
                    filter: 'key=in.(permissions_supervisor,permissions_motorista,permissions_oficina,permissions_gestor)'
                },
                (payload) => {
                    const { key, value } = payload.new as { key: string; value: PermissionModule[] };

                    setPermissions(prev => {
                        const nextPerms = { ...prev };
                        if (key === 'permissions_supervisor' && Array.isArray(value)) {
                            nextPerms.supervisor = value;
                        } else if (key === 'permissions_motorista' && Array.isArray(value)) {
                            nextPerms.motorista = value;
                        } else if (key === 'permissions_oficina' && Array.isArray(value)) {
                            nextPerms.oficina = value;
                        } else if (key === 'permissions_gestor' && Array.isArray(value)) {
                            nextPerms.gestor = value;
                        }
                        return nextPerms;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updatePermission = async (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', module: PermissionModule, hasAccess: boolean) => {
        // Use functional state to ensure we have the absolute latest permissions
        setPermissions(prev => {
            const currentPerms = [...(prev[role] || [])];
            let nextPerms: typeof currentPerms;

            if (hasAccess) {
                nextPerms = currentPerms.includes(module) ? currentPerms : [...currentPerms, module];
            } else {
                nextPerms = currentPerms.filter(p => p !== module);
            }

            const updatedAll = { ...prev, [role]: nextPerms };
            return updatedAll;
        });
    };

    const saveAllPermissions = async (newPermissions: RolePermissions) => {
        const roles: (keyof RolePermissions)[] = ['supervisor', 'motorista', 'oficina', 'gestor'];

        // We use a clean-write approach: Delete existings globals then Insert new
        // This avoids "onConflict" issues with (user_id, key) if user_id is null vs undefined
        const updates = roles.map(async (role) => {
            const dbKey = `permissions_${role}`;

            // 1. Delete Query
            const { error: delError } = await supabase
                .from('app_settings')
                .delete()
                .eq('key', dbKey)
                .is('user_id', null); // Target global settings

            if (delError) {
                return { error: delError };
            }

            // 2. Insert Query
            return supabase
                .from('app_settings')
                .insert({
                    key: dbKey,
                    value: newPermissions[role],
                    user_id: null // Explicitly global
                })
                .select();
        });

        try {
            const results = await Promise.all(updates);

            // Check for any errors in the batch (nested responses)
            // results[i] might be { error } from delete or { data, error } from insert
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('Errors saving permissions:', errors);
                throw new Error('Falha ao gravar permissões (conflito de dados).');
            }

            // Only update local state if successful
            setPermissions(newPermissions);
            console.log('All permissions saved successfully');
        } catch (error) {
            console.error('Error batch saving permissions:', error);
            throw error; // Let the caller handle the error UI
        }
    };

    const updateGranularPermission = async (userId: string, module: SystemModule, action: PermissionAction, hasAccess: boolean) => {
        try {
            // Get current permissions from UserProfile
            const { data: profile } = await supabase.from('user_profiles').select('permissions').eq('id', userId).single();
            let currentPerms: DetailedPermissions = profile?.permissions || {};

            const modulePerms = currentPerms[module] || [];
            let newModulePerms: PermissionAction[] = [];

            if (hasAccess) {
                newModulePerms = Array.from(new Set([...modulePerms, action]));
            } else {
                newModulePerms = modulePerms.filter(a => a !== action);
            }

            const updatedPerms = { ...currentPerms, [module]: newModulePerms };

            const { error } = await supabase
                .from('user_profiles')
                .update({ permissions: updatedPerms })
                .eq('id', userId);

            if (error) throw error;

            // Log the change
            await supabase.from('audit_logs').insert({
                action: 'UPDATE_PERMISSIONS',
                performed_by: (currentUser as UserProfile)?.id,
                target_id: userId,
                details: { module, action, granted: hasAccess }
            });

            await refreshCurrentUser();
        } catch (error) {
            console.error('Error updating granular permission:', error);
            throw error;
        }
    };

    const hasAccess = (
        role: UserRole | string | null,
        module: SystemModule | any,
        action: PermissionAction = 'ver'
    ): boolean => {
        if (!role) return false;

        const normalizedRole = role.toUpperCase();
        if (normalizedRole === 'ADMIN_MASTER') return true;

        // 1. Resolve Module and Action
        let targetModule = module as SystemModule;
        let targetAction = action;

        // If it's a legacy module string (e.g., 'requisicoes_edit'), map it
        if (LEGACY_MAP[module]) {
            targetModule = LEGACY_MAP[module].module;
            targetAction = LEGACY_MAP[module].action;
        }

        // 2. Check Individual Overrides First
        const user = currentUser as UserProfile;
        if (user && user.permissions) {
            const userModulePerms = user.permissions[targetModule];
            if (userModulePerms) {
                return userModulePerms.includes(targetAction);
            }
        }

        // 3. Check for legacy blockedPermissions (backward compat)
        if (user && (user as any).blockedPermissions) {
            const blocked = (user as any).blockedPermissions;
            if (blocked.includes(module)) return false;
        }

        // 4. Fallback to Role Defaults
        const defaults = roleDefaults[normalizedRole as UserRole];
        if (defaults) {
            const modulePerms = defaults[targetModule];
            return modulePerms ? modulePerms.includes(targetAction) : false;
        }

        // 5. Legacy list fallback
        if (['GESTOR', 'SUPERVISOR', 'MOTORISTA', 'OFICINA'].includes(normalizedRole)) {
            const legacyRoleKey = normalizedRole.toLowerCase() as keyof RolePermissions;
            const legacyPerms = permissions[legacyRoleKey];
            if (legacyPerms && (legacyPerms as any[]).includes(module)) return true;
        }

        return false;
    };

    return (
        <PermissionsContext.Provider value={{
            permissions,
            roleDefaults,
            updatePermission,
            saveAllPermissions,
            hasAccess,
            updateGranularPermission
        }}>
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
}
