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
    'avaliacao' |
    'roteirizacao' |
    'via_verde';

export interface RolePermissions {
    supervisor: PermissionModule[];
    motorista: PermissionModule[];
    oficina: PermissionModule[];
    gestor: PermissionModule[];
}

import type { UserRole } from '../types';

interface PermissionsContextType {
    permissions: RolePermissions;
    updatePermission: (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', module: PermissionModule, hasAccess: boolean) => void;
    saveAllPermissions: (newPermissions: RolePermissions) => Promise<void>;
    hasAccess: (role: UserRole | 'admin' | 'supervisor' | 'motorista' | 'oficina' | 'gestor' | null, module: PermissionModule) => boolean;
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
        'locais', 'avaliacao',
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
        'central_navegacao', 'central_recibos',
        'locais', 'avaliacao'
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
        'central_navegacao', 'central_recibos',
        'locais', 'avaliacao'
    ]
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { currentUser } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

    // Initial Fetch from DB and Realtime Subscription
    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .in('key', ['permissions_supervisor', 'permissions_motorista', 'permissions_oficina', 'permissions_gestor']);

                if (error) {
                    console.error('Error fetching permissions:', error);
                    return;
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

    const hasAccess = (role: UserRole | 'admin' | 'supervisor' | 'motorista' | 'oficina' | 'gestor' | null, module: PermissionModule): boolean => {
        if (!role) return false;

        // Normalize role for comparison
        const normalizedRole = role.toLowerCase();

        if (normalizedRole === 'admin' || normalizedRole === 'admin_master') return true; // Admin always has access

        // Map UserRole to RolePermissions keys if necessary
        let roleKey: keyof RolePermissions | null = null;
        if (normalizedRole === 'gestor') roleKey = 'gestor';
        else if (normalizedRole === 'supervisor') roleKey = 'supervisor';
        else if (normalizedRole === 'motorista') roleKey = 'motorista';
        else if (normalizedRole === 'oficina') roleKey = 'oficina';

        if (!roleKey) return false;

        // Check local permissions for other roles
        const rolePerms = permissions[roleKey];
        const allowedByRole = rolePerms ? rolePerms.includes(module) : false;

        // Check for user-specific blocks
        if (allowedByRole && currentUser) {
            const blocked = (currentUser as any).blockedPermissions;
            if (blocked && Array.isArray(blocked) && blocked.includes(module)) {
                return false;
            }
        }

        return allowedByRole;
    };

    return (
        <PermissionsContext.Provider value={{ permissions, updatePermission, saveAllPermissions, hasAccess }}>
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
