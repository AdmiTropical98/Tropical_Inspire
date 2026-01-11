import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWorkshop } from './WorkshopContext';
import type { Motorista, Supervisor, OficinaUser, AdminUser } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    isAuthenticated: boolean;
    userRole: 'admin' | 'motorista' | 'supervisor' | 'oficina' | null;
    currentUser: Motorista | Supervisor | OficinaUser | AdminUser | null;
    userStatus: 'online' | 'absent' | 'offline';
    language: 'pt' | 'en';
    login: (type: 'admin' | 'motorista' | 'supervisor' | 'oficina', identifier: string, credential: string) => Promise<boolean>;
    logout: () => void;
    updateStatus: (status: 'online' | 'absent' | 'offline') => void;
    refreshCurrentUser: () => Promise<void>;
    setLanguage: (lang: 'pt' | 'en') => void;
    updateUserPhoto: (photo: string) => void;
    userPhoto: string | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { motoristas, supervisors, oficinaUsers } = useWorkshop();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState<'admin' | 'motorista' | 'supervisor' | 'oficina' | null>(null);
    const [currentUser, setCurrentUser] = useState<Motorista | Supervisor | OficinaUser | AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // New State for UI Preferences
    const [userStatus, setUserStatus] = useState<'online' | 'absent' | 'offline'>('online');
    const [language, setLanguage] = useState<'pt' | 'en'>('pt');
    const [userPhoto, setUserPhoto] = useState<string | undefined>(undefined);

    const refreshCurrentUser = async () => {
        if (!currentUser || !userRole) return;
        try {
            let table = '';
            if (userRole === 'motorista') table = 'motoristas';
            else if (userRole === 'supervisor') table = 'supervisores';
            else if (userRole === 'oficina') table = 'oficina_users';

            if (table) {
                const { data, error } = await supabase.from(table).select('*').eq('id', currentUser.id).single();
                if (!error && data) {
                    // Map snake_case to camelCase for Motorista if needed
                    let updatedUser = { ...data };
                    if (userRole === 'motorista') {
                        updatedUser = {
                            ...data,
                            cartrackKey: data.cartrack_key,
                            cartrackId: data.cartrack_id,
                            vencimentoBase: data.vencimento_base,
                            valorHora: data.valor_hora,
                            turnoInicio: data.turno_inicio,
                            turnoFim: data.turno_fim
                        };
                    }

                    setCurrentUser(updatedUser);
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    if (updatedUser.foto) setUserPhoto(updatedUser.foto);
                }
            }
        } catch (e) {
            console.error("Error refreshing user:", e);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            const storedAuth = localStorage.getItem('isAuthenticated');
            const storedRole = localStorage.getItem('userRole');
            const storedUser = localStorage.getItem('currentUser');
            const storedStatus = localStorage.getItem('userStatus');
            const storedLang = localStorage.getItem('appLanguage');

            if (storedAuth === 'true' && storedRole) {
                setIsAuthenticated(true);
                setUserRole(storedRole as any);

                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setCurrentUser(parsedUser);
                        if (parsedUser.foto) setUserPhoto(parsedUser.foto);

                        // SYNC WITH SUPABASE ON START: Ensure we have latest data (like registered tag)
                        const table = storedRole === 'motorista' ? 'motoristas' :
                            storedRole === 'supervisor' ? 'supervisores' :
                                storedRole === 'oficina' ? 'oficina_users' : '';

                        if (table) {
                            const { data } = await supabase.from(table).select('*').eq('id', parsedUser.id).single();
                            if (data) {
                                let refreshed = { ...data };
                                if (storedRole === 'motorista') {
                                    refreshed = {
                                        ...data,
                                        cartrackKey: data.cartrack_key,
                                        cartrackId: data.cartrack_id,
                                        vencimentoBase: data.vencimento_base,
                                        valorHora: data.valor_hora,
                                        turnoInicio: data.turno_inicio,
                                        turnoFim: data.turno_fim
                                    };
                                }
                                setCurrentUser(refreshed);
                                localStorage.setItem('currentUser', JSON.stringify(refreshed));
                                if (refreshed.foto) setUserPhoto(refreshed.foto);
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing/syncing stored user", e);
                    }
                }

                if (storedRole === 'admin') {
                    const adminPhoto = localStorage.getItem('adminPhoto');
                    if (adminPhoto) setUserPhoto(adminPhoto);

                    const { data } = await supabase.auth.getUser();
                    if (data.user) {
                        const adminUser: AdminUser = {
                            id: data.user.id,
                            email: data.user.email || '',
                            role: 'admin',
                            nome: 'Administrador',
                            createdAt: new Date().toISOString()
                        };
                        setCurrentUser(adminUser);
                        localStorage.setItem('currentUser', JSON.stringify(adminUser));
                    }
                }
            } else if (storedAuth) {
                // Cleanup invalid state
                logout();
            }

            if (storedStatus) setUserStatus(storedStatus as any);
            if (storedLang) setLanguage(storedLang as any);

            setIsLoading(false);
        };

        initAuth();
    }, []);

    const updateStatus = (status: 'online' | 'absent' | 'offline') => {
        setUserStatus(status);
        localStorage.setItem('userStatus', status);
    };

    const updateLanguage = (lang: 'pt' | 'en') => {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
    };

    const updateUserPhoto = (photo: string) => {
        setUserPhoto(photo);
        if (userRole === 'admin') {
            localStorage.setItem('adminPhoto', photo);
        } else if (currentUser) {
            const updatedUser = { ...currentUser, foto: photo };
            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
    };

    const logout = () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUser');
        setIsAuthenticated(false);
        setUserRole(null);
        setCurrentUser(null);
        setUserPhoto(undefined);
    };

    if (isLoading) {
        return <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center text-slate-400">Carregando...</div>;
    }

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            userRole,
            currentUser,
            userStatus,
            language,
            login,
            logout,
            updateStatus,
            refreshCurrentUser,
            setLanguage: updateLanguage,
            updateUserPhoto,
            userPhoto
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
