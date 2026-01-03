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
        'supervisores', 'clientes'
    ]
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { currentUser, userRole } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
    const [loading, setLoading] = useState(true);

    // Initial Fetch from DB
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['permissions_supervisor', 'permissions_motorista', 'permissions_oficina']);

                if (error) throw error;

                if (data) {
                    const newPermissions = { ...DEFAULT_PERMISSIONS };
                    data.forEach((item: any) => {
                        if (item.key === 'permissions_supervisor') newPermissions.supervisor = item.value;
                        if (item.key === 'permissions_motorista') newPermissions.motorista = item.value;
                        if (item.key === 'permissions_oficina') newPermissions.oficina = item.value;
                    });
                    setPermissions(newPermissions);
                }
            } catch (err) {
                console.error('Error fetching permissions from DB:', err);
                // Fallback to defaults is already set via initial state
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();

        // Subscribe to changes for real-time updates
        const channel = supabase
            .channel('app_settings_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
                const { key, value } = payload.new as any;
                if (['permissions_supervisor', 'permissions_motorista', 'permissions_oficina'].includes(key)) {
                    setPermissions(prev => {
                        const updated = { ...prev };
                        if (key === 'permissions_supervisor') updated.supervisor = value;
                        if (key === 'permissions_motorista') updated.motorista = value;
                        if (key === 'permissions_oficina') updated.oficina = value;
                        return updated;
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updatePermission = async (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule, hasAccess: boolean) => {
        const currentRolePermissions = permissions[role];
        let newRolePermissions: PermissionModule[];

        if (hasAccess) {
            if (!currentRolePermissions.includes(module)) {
                newRolePermissions = [...currentRolePermissions, module];
            } else {
                newRolePermissions = currentRolePermissions;
            }
        } else {
            newRolePermissions = currentRolePermissions.filter(p => p !== module);
        }

        // Optimistic Update
        setPermissions(prev => ({
            ...prev,
            [role]: newRolePermissions
        }));

        // Persist to DB
        const dbKey = `permissions_${role}`;
        const { error } = await supabase.from('app_settings').upsert({ key: dbKey, value: newRolePermissions });

        if (error) {
            console.error('Error updating permissions in DB:', error);
            // Revert optimistic update? Or just alert. For now simple logging.
            alert('Falha ao gravar permissões. Verifique a ligação.');
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
