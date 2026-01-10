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

    useEffect(() => {
        const initAuth = async () => {
            const storedAuth = localStorage.getItem('isAuthenticated');
            const storedRole = localStorage.getItem('userRole');
            const storedUser = localStorage.getItem('currentUser');
            const storedStatus = localStorage.getItem('userStatus');
            const storedLang = localStorage.getItem('appLanguage');

            if (storedAuth === 'true') {
                if (storedRole) {
                    setIsAuthenticated(true);
                    setUserRole(storedRole as any);

                    let currentUserLoaded = false;

                    if (storedUser) {
                        try {
                            const parsedUser = JSON.parse(storedUser);
                            setCurrentUser(parsedUser);
                            if (parsedUser.foto) setUserPhoto(parsedUser.foto);
                            currentUserLoaded = true;
                        } catch (e) {
                            console.error("Error parsing stored user", e);
                        }
                    }

                    if (storedRole === 'admin') {
                        const adminPhoto = localStorage.getItem('adminPhoto');
                        if (adminPhoto) setUserPhoto(adminPhoto);

                        // Attempts to recover AdminUser from Supabase if not in localStorage to fix "Dual Auth" issues
                        if (!currentUserLoaded) {
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
                    }
                } else {
                    // Invalid state cleanup
                    localStorage.removeItem('isAuthenticated');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('currentUser');
                    setIsAuthenticated(false);
                    setUserRole(null);
                    setCurrentUser(null);
                    setUserPhoto(undefined);
                }
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
    }

    const updateUserPhoto = (photo: string) => {
        setUserPhoto(photo);
        if (userRole === 'admin') {
            localStorage.setItem('adminPhoto', photo);
        } else if (currentUser) {
            const updatedUser = { ...currentUser, foto: photo };
            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            // Note: In a real app, we would also update the specific user list in WorkshopContext
        }
    };

    const login = async (type: 'admin' | 'motorista' | 'supervisor' | 'oficina', identifier: string, credential: string) => {
        if (type === 'admin') {
            // Supabase Auth for Admin
            const { data, error } = await supabase.auth.signInWithPassword({
                email: identifier,
                password: credential
            });

            if (!error && data.user) {
                // Construct Admin User Object
                const adminUser: AdminUser = {
                    id: data.user.id,
                    email: identifier,
                    role: 'admin',
                    nome: 'Administrador',
                    createdAt: new Date().toISOString()
                };

                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('currentUser', JSON.stringify(adminUser)); // Save Admin User!

                setIsAuthenticated(true);
                setUserRole('admin');
                setCurrentUser(adminUser);

                const adminPhoto = localStorage.getItem('adminPhoto');
                if (adminPhoto) setUserPhoto(adminPhoto);
                return true;
            }
            return false;
        } else if (type === 'oficina') {
            // Oficina Login (Dynamic)
            const staff = oficinaUsers.find(u =>
                u.email.toLowerCase() === identifier.toLowerCase() &&
                u.pin === credential &&
                u.status === 'active'
            );

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
            // Remove all non-numeric characters from input
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');

            const supervisor = supervisors.find(s => {
                // Remove all non-numeric characters from stored phone
                const cleanPhone = (s.telemovel || '').replace(/[^0-9]/g, '');

                // Check if one ends with the other (to handle +351 vs no +351)
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
            // Remove all non-numeric characters from input
            const cleanIdentifier = identifier.replace(/[^0-9]/g, '');

            const driver = motoristas.find(m => {
                // Remove all non-numeric characters from stored contact
                const cleanContact = m.contacto.replace(/[^0-9]/g, '');

                // Check if one ends with the other (to handle +351 vs no +351)
                // e.g. 351912345678 ends with 912345678 -> Match
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
