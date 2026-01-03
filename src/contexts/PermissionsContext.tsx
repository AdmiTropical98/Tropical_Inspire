import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

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
    'clientes';

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
        'plataformas_externas'
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
        'motoristas', 'fornecedores', 'equipa-oficina', 'plataformas_externas'
    ]
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { currentUser, userRole } = useAuth();
    const [permissions, setPermissions] = useState<RolePermissions>(() => {
        try {
            const stored = localStorage.getItem('permissions');
            if (stored) {
                const parsed = JSON.parse(stored);

                // MIGRATION / PATCH: Ensure new defaults are present in legacy configurations
                if (Array.isArray(parsed.supervisor)) {
                    const newSupDefaults = [
                        'centros_custos', 'plataformas_externas',
                        'requisicoes_edit', 'requisicoes_delete',
                        'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
                        'hours_view_costs',
                        'combustivel_calibrate', 'combustivel_edit_history'
                    ];
                    newSupDefaults.forEach(p => {
                        if (!parsed.supervisor.includes(p)) parsed.supervisor.push(p);
                    });
                }
                if (Array.isArray(parsed.motorista)) {
                    const newDriverDefaults = [
                        'central_motorista', 'horas', 'escalas',
                        'requisicoes_edit', 'requisicoes_delete',
                        'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
                        'hours_view_costs',
                        'combustivel_calibrate', 'combustivel_edit_history'
                    ];
                    newDriverDefaults.forEach(p => {
                        if (!parsed.motorista.includes(p)) parsed.motorista.push(p);
                    });
                }
                if (Array.isArray(parsed.oficina)) {
                    const newOfficeDefaults = [
                        'centros_custos',
                        'requisicoes_edit', 'requisicoes_delete',
                        'combustivel_calibrate', 'combustivel_edit_history',
                        'escalas_import', 'escalas_print', 'escalas_create', 'escalas_urgent', 'escalas_view_pending',
                        'hours_view_costs'
                    ];
                    newOfficeDefaults.forEach(p => {
                        if (!parsed.oficina.includes(p)) parsed.oficina.push(p);
                    });
                }

                // Validate structure
                const safePermissions = { ...DEFAULT_PERMISSIONS, ...parsed };
                // Ensure arrays
                if (!Array.isArray(safePermissions.supervisor)) safePermissions.supervisor = DEFAULT_PERMISSIONS.supervisor;
                if (!Array.isArray(safePermissions.motorista)) safePermissions.motorista = DEFAULT_PERMISSIONS.motorista;
                if (!Array.isArray(safePermissions.oficina)) safePermissions.oficina = DEFAULT_PERMISSIONS.oficina;
                return safePermissions;
            }
        } catch (error) {
            console.error('Error loading permissions:', error);
        }
        return DEFAULT_PERMISSIONS;
    });

    useEffect(() => {
        localStorage.setItem('permissions', JSON.stringify(permissions));
    }, [permissions]);

    const updatePermission = (role: 'supervisor' | 'motorista' | 'oficina', module: PermissionModule, hasAccess: boolean) => {
        setPermissions(prev => {
            const currentRolePermissions = prev[role];
            let newRolePermissions: PermissionModule[];

            if (hasAccess) {
                // Add if not present
                if (!currentRolePermissions.includes(module)) {
                    newRolePermissions = [...currentRolePermissions, module];
                } else {
                    newRolePermissions = currentRolePermissions;
                }
            } else {
                // Remove if present
                newRolePermissions = currentRolePermissions.filter(p => p !== module);
            }

            return {
                ...prev,
                [role]: newRolePermissions
            };
        });
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
