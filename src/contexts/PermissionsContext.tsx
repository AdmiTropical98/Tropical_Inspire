import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export type PermissionModule = 'requisicoes' | 'requisicoes_edit' | 'requisicoes_delete' |
    'viaturas' |
    'motoristas' |
    'fornecedores' |
    'escalas' | 'escalas_import' | 'escalas_print' | 'escalas_create' | 'escalas_urgent' | 'escalas_view_pending' |
    'horas' | 'hours_view_costs' |
    'equipa-oficina' |
    'supervisores' |
    'combustivel' | 'combustivel_calibrate' | 'combustivel_edit_history' |
    'central_motorista' |
    'centros_custos' |
    'plataformas_externas' |
    'clientes' |
    'relatorios' |
    'contabilidade';

export interface RolePermissions {
    supervisor: PermissionModule[];
    motorista: PermissionModule[];
    oficina: PermissionModule[];
}

interface PermissionsContextType {
    permissions: RolePermissions;
    updatePermission: (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule, hasAccess: boolean) => void;
    hasAccess: (role: 'admin' | 'supervisor' | 'motorista' | 'oficina' | null, module: PermissionModule) => boolean;
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
        'contabilidade'
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
        'centros_custos',
        'plataformas_externas'
    ],
    oficina: [
        'viaturas',
        'requisicoes', 'requisicoes_edit', 'requisicoes_delete',
        'combustivel', 'combustivel_calibrate', 'combustivel_edit_history',
        'centros_custos',
        'escalas', 'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
        'horas', 'hours_view_costs',
        'motoristas', 'fornecedores', 'equipa-oficina', 'plataformas_externas',
        'supervisores', 'clientes', 'relatorios'
    ]
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { currentUser, userRole } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

    // Initial Fetch from DB
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['permissions_supervisor', 'permissions_motorista', 'permissions_oficina']);

                if (error) throw error;

                if (data && data.length > 0) {
                    setPermissions(prev => {
                        const newPermissions = { ...prev };
                        data.forEach((item: any) => {
                            if (item.key === 'permissions_supervisor' && Array.isArray(item.value)) {
                                newPermissions.supervisor = item.value;
                            }
                            if (item.key === 'permissions_motorista' && Array.isArray(item.value)) {
                                newPermissions.motorista = item.value;
                            }
                            if (item.key === 'permissions_oficina' && Array.isArray(item.value)) {
                                newPermissions.oficina = item.value;
                            }
                        });
                        return newPermissions;
                    });
                }
            } catch (err) {
                console.error('Error fetching permissions from DB:', err);
            }
        };

        fetchPermissions();
    }, []);

    const updatePermission = async (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule, hasAccess: boolean) => {
        const currentRolePerms = [...(permissions[role] || [])];

        // Calculate new state
        let nextRolePerms: PermissionModule[];
        if (hasAccess) {
            nextRolePerms = currentRolePerms.includes(module) ? currentRolePerms : [...currentRolePerms, module];
        } else {
            nextRolePerms = currentRolePerms.filter(p => p !== module);
        }

        // Optimistic Update
        setPermissions(prev => ({
            ...prev,
            [role]: nextRolePerms
        }));

        // Persist to DB
        const dbKey = `permissions_${role}`;
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert(
                    { key: dbKey, value: nextRolePerms },
                    { onConflict: 'key' }
                );

            if (error) {
                console.error('Error saving permissions:', error);
                setPermissions(prev => ({ ...prev, [role]: currentRolePerms }));
                alert(`Erro ao gravar: ${error.message}`);
            }
        } catch (err: any) {
            console.error('Fatal error saving permissions:', err);
            setPermissions(prev => ({ ...prev, [role]: currentRolePerms }));
        }
    };

    const hasAccess = (role: 'admin' | 'supervisor' | 'motorista' | 'oficina' | null, module: PermissionModule): boolean => {
        if (!role) return false;
        if (role === 'admin') return true; // Admin always has access

        // Check local permissions for other roles
        const rolePerms = permissions[role];
        const allowedByRole = rolePerms ? rolePerms.includes(module) : false;

        // Check for user-specific blocks
        if (allowedByRole && role === userRole && currentUser) {
            const blocked = (currentUser as any).blockedPermissions;
            if (blocked && Array.isArray(blocked) && blocked.includes(module)) {
                return false;
            }
        }

        return allowedByRole;
    };

    return (
        <PermissionsContext.Provider value={{ permissions, updatePermission, hasAccess }}>
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
