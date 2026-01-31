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
    'avaliacao';

export interface RolePermissions {
    supervisor: PermissionModule[];
    motorista: PermissionModule[];
    oficina: PermissionModule[];
    gestor: PermissionModule[];
}

interface PermissionsContextType {
    permissions: RolePermissions;
    updatePermission: (role: 'supervisor' | 'motorista' | 'oficina' | 'gestor', module: PermissionModule, hasAccess: boolean) => void;
    hasAccess: (role: 'admin' | 'supervisor' | 'motorista' | 'oficina' | 'gestor' | null, module: PermissionModule) => boolean;
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
    const { currentUser, userRole } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

    // Initial Fetch from DB
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

            // Persist to DB immediately
            const dbKey = `permissions_${role}`;
            supabase
                .from('app_settings')
                .upsert({ key: dbKey, value: nextPerms }, { onConflict: 'key' })
                .then(({ error }) => {
                    if (error) {
                        console.error(`Error saving ${dbKey}:`, error);
                        // Optional: Revert state on failure
                    } else {
                        console.log(`Successfully saved ${dbKey}`);
                    }
                });

            return updatedAll;
        });
    };

    const hasAccess = (role: 'admin' | 'supervisor' | 'motorista' | 'oficina' | 'gestor' | null, module: PermissionModule): boolean => {
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
