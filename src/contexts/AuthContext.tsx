import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWorkshop } from './WorkshopContext';
import { supabase } from '../lib/supabase';
import SplashScreen from '../components/common/SplashScreen';
import type { Motorista, Supervisor, OficinaUser, AdminUser, Gestor, UserRole, UserProfile } from '../types';

interface AuthContextType {
    isAuthenticated: boolean;
    userRole: UserRole | 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor' | null;
    currentUser: UserProfile | Motorista | Supervisor | OficinaUser | AdminUser | Gestor | null;
    isEmailConfirmed: boolean;
    userStatus: 'online' | 'absent' | 'offline';
    language: 'pt' | 'en';
    login: (type: 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor' | UserRole, identifier: string, credential: string) => Promise<boolean>;
    logout: () => void;
    updateStatus: (status: 'online' | 'absent' | 'offline') => void;
    refreshCurrentUser: () => Promise<void>;
    setLanguage: (lang: 'pt' | 'en') => void;
    updateUserPhoto: (photo: string) => void;
    userPhoto: string | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { motoristas, supervisors, oficinaUsers, gestores } = useWorkshop();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor' | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | Motorista | Supervisor | OficinaUser | AdminUser | Gestor | null>(null);
    const [isEmailConfirmed, setIsEmailConfirmed] = useState(true); // Default true for PIN users
    const [isLoading, setIsLoading] = useState(true);
    const [isSplashExiting, setIsSplashExiting] = useState(false);

    const [userStatus, setUserStatus] = useState<'online' | 'absent' | 'offline'>('online');
    const [language, setLanguage] = useState<'pt' | 'en'>('pt');
    const [userPhoto, setUserPhoto] = useState<string | undefined>(undefined);

    async function refreshCurrentUser() {
        if (!currentUser || !userRole) return;
        try {
            let table = '';
            if (userRole === 'motorista') table = 'motoristas';
            else if (userRole === 'supervisor') table = 'supervisores';
            else if (userRole === 'gestor') table = 'gestores';
            else if (userRole === 'oficina') table = 'oficina_users';

            if (table) {
                const { data, error } = await supabase.from(table).select('*').eq('id', currentUser.id).single();
                if (!error && data) {
                    let updatedUser = { ...data };
                    if (userRole === 'motorista') {
                        updatedUser = {
                            ...data,
                            cartrackKey: data.cartrack_key,
                            cartrackId: data.cartrack_id,
                            vencimentoBase: data.vencimento_base,
                            valorHora: data.valor_hora,
                            turnoInicio: data.turno_inicio,
                            turnoFim: data.turno_fim,
                            cartaConducao: data.carta_conducao,
                            dataRegisto: data.data_registo,
                            blockedPermissions: data.blocked_permissions,
                            status: data.status || 'disponivel',
                            currentVehicle: data.current_vehicle
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
    }

    useEffect(() => {
        let isCancelled = false;

        const wait = (ms: number) => new Promise<void>((resolve) => {
            window.setTimeout(resolve, ms);
        });

        async function initAuth() {
            const splashStart = Date.now();
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
                                        turnoFim: data.turno_fim,
                                        cartaConducao: data.carta_conducao,
                                        dataRegisto: data.data_registo,
                                        blockedPermissions: data.blocked_permissions,
                                        status: data.status || 'disponivel',
                                        currentVehicle: data.current_vehicle
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

                if (storedRole === 'admin' || (storedRole && ['ADMIN_MASTER', 'ADMIN', 'GESTOR', 'SUPERVISOR', 'OFICINA', 'MOTORISTA'].includes(storedRole))) {
                    const adminPhoto = localStorage.getItem('adminPhoto');
                    if (adminPhoto) setUserPhoto(adminPhoto);

                    const { data } = await supabase.auth.getUser();
                    if (data.user) {
                        // Check profile
                        const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', data.user.id).single();

                        const appUser: UserProfile = {
                            id: data.user.id,
                            email: data.user.email || '',
                            nome: profile?.nome || 'Utilizador',
                            role: (profile?.role || storedRole) as UserRole,
                            status: profile?.status,
                            email_confirmed: data.user.email_confirmed_at !== null,
                            permissions: profile?.permissions, // Load granular permissions
                            createdAt: data.user.created_at,
                            updatedAt: new Date().toISOString()
                        };

                        if (appUser.status === 'BLOCKED') {
                            logout();
                            return;
                        }

                        setCurrentUser(appUser);
                        setIsEmailConfirmed(appUser.email_confirmed);
                        localStorage.setItem('currentUser', JSON.stringify(appUser));
                    }
                }
            } else if (storedAuth) {
                logout();
            }

            if (storedStatus) setUserStatus(storedStatus as any);
            if (storedLang) setLanguage(storedLang as any);

            // Keep splash visible for at least 1.8s to avoid abrupt startup.
            const elapsed = Date.now() - splashStart;
            const remaining = Math.max(0, 1800 - elapsed);
            if (remaining > 0) {
                await wait(remaining);
            }

            if (isCancelled) return;

            // Smooth fade-out before transitioning into login/dashboard.
            setIsSplashExiting(true);
            await wait(380);

            if (isCancelled) return;
            setIsLoading(false);
        }

        initAuth();

        return () => {
            isCancelled = true;
        };
    }, []);

    function updateStatus(status: 'online' | 'absent' | 'offline') {
        setUserStatus(status);
        localStorage.setItem('userStatus', status);
    }

    function updateLanguage(lang: 'pt' | 'en') {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
    }

    async function login(type: UserRole | 'admin' | 'motorista' | 'supervisor' | 'oficina' | 'gestor', identifier: string, credential: string) {
        if (type === 'admin' || type === 'ADMIN_MASTER' || type === 'ADMIN') {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: identifier,
                password: credential
            });

            if (!error && data.user) {
                // Fetch Profile from user_profiles
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profile?.status === 'BLOCKED') {
                    await supabase.auth.signOut();
                    alert('A sua conta encontra-se BLOQUEADA. Contacte o administrador.');
                    return false;
                }

                const roleToSave = profile?.role || (type === 'admin' ? 'ADMIN' : type);

                const appUser: UserProfile = {
                    id: data.user.id,
                    email: identifier,
                    nome: profile?.nome || 'Utilizador',
                    role: roleToSave as UserRole,
                    status: profile?.status,
                    email_confirmed: data.user.email_confirmed_at !== null,
                    permissions: profile?.permissions, // Load granular permissions
                    createdAt: data.user.created_at,
                    updatedAt: new Date().toISOString()
                };

                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', roleToSave);
                localStorage.setItem('currentUser', JSON.stringify(appUser));

                setIsAuthenticated(true);
                setUserRole(roleToSave as UserRole);
                setCurrentUser(appUser);
                setIsEmailConfirmed(appUser.email_confirmed);

                // Update last login
                await supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);

                const adminPhoto = localStorage.getItem('adminPhoto');
                if (adminPhoto) setUserPhoto(adminPhoto);
                return true;
            }
            return false;
        } else if (type === 'gestor') {
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');
            const gestor = gestores.find(g => {
                const cleanPhone = (g.telemovel || '').replace(/[^0-9]/g, '');
                const phoneMatch = (cleanPhone !== '' && cleanIdentifier !== '') &&
                    (cleanPhone.endsWith(cleanIdentifier) || cleanIdentifier.endsWith(cleanPhone));
                const emailMatch = g.email && g.email.toLowerCase() === identifier.toLowerCase();
                return (phoneMatch || emailMatch) && g.pin === credential && g.status === 'active';
            });

            if (gestor) {
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', 'gestor');
                localStorage.setItem('currentUser', JSON.stringify(gestor));
                setIsAuthenticated(true);
                setUserRole('gestor');
                setCurrentUser(gestor);
                if (gestor.foto) setUserPhoto(gestor.foto);
                return true;
            }
        } else if (type === 'oficina') {
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');
            const staff = oficinaUsers.find(u => {
                const cleanPhone = (u.telemovel || '').replace(/[^0-9]/g, '');
                const phoneMatch = (cleanPhone !== '' && cleanIdentifier !== '') &&
                    (cleanPhone.endsWith(cleanIdentifier) || cleanIdentifier.endsWith(cleanPhone));
                return phoneMatch && u.pin === credential && u.status === 'active';
            });

            if (staff) {
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', 'oficina');
                localStorage.setItem('currentUser', JSON.stringify(staff));
                setIsAuthenticated(true);
                setUserRole('oficina');
                setCurrentUser(staff);
                if (staff.foto) setUserPhoto(staff.foto);
                return true;
            }
        } else if (type === 'supervisor') {
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');
            const supervisor = supervisors.find(s => {
                const cleanPhone = (s.telemovel || '').replace(/[^0-9]/g, '');
                const phoneMatch = (cleanPhone !== '' && cleanIdentifier !== '') &&
                    (cleanPhone.endsWith(cleanIdentifier) || cleanIdentifier.endsWith(cleanPhone));
                const emailMatch = s.email && s.email.toLowerCase() === identifier.toLowerCase();
                return (phoneMatch || emailMatch) && s.pin === credential && s.status === 'active';
            });

            if (supervisor) {
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', 'supervisor');
                localStorage.setItem('currentUser', JSON.stringify(supervisor));
                setIsAuthenticated(true);
                setUserRole('supervisor');
                setCurrentUser(supervisor);
                if (supervisor.foto) setUserPhoto(supervisor.foto);
                return true;
            }
        } else if (type === 'motorista') {
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');
            const driver = motoristas.find(m => {
                const cleanContact = m.contacto.replace(/[^0-9]/g, '');
                const contactMatch = (cleanContact !== '' && cleanIdentifier !== '') &&
                    (cleanContact.endsWith(cleanIdentifier) || cleanIdentifier.endsWith(cleanContact));
                const emailMatch = m.email && m.email.toLowerCase() === identifier.toLowerCase();
                return (contactMatch || emailMatch) && m.pin === credential;
            });

            if (driver) {
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', 'motorista');
                localStorage.setItem('currentUser', JSON.stringify(driver));
                setIsAuthenticated(true);
                setUserRole('motorista');
                setCurrentUser(driver);
                if (driver.foto) setUserPhoto(driver.foto);
                return true;
            }
        }
        return false;
    }

    function updateUserPhoto(photo: string) {
        setUserPhoto(photo);
        if (userRole === 'admin') {
            localStorage.setItem('adminPhoto', photo);
        } else if (currentUser) {
            const updatedUser = { ...currentUser, foto: photo };
            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
    }

    function logout() {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUser');
        setIsAuthenticated(false);
        setUserRole(null);
        setCurrentUser(null);
        setUserPhoto(undefined);
    }

    if (isLoading) {
        return <SplashScreen message="A carregar dados..." exiting={isSplashExiting} />;
    }

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            userRole,
            currentUser,
            isEmailConfirmed,
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
