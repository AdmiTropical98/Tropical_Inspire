import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';
import {
    User,
    Mail,
    Phone,
    Key,
    Save,
    Shield,
    AlertCircle,
    CheckCircle2,
    Clock3,
    Globe,
    UserCircle2,
    Lock,
    MapPin,
    Upload,
    Images,
    X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MyProfile() {
    const { currentUser, userRole, refreshCurrentUser, updateUserPhoto } = useAuth();
    const { updateMotorista, updateSupervisor, updateOficinaUser } = useWorkshop();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Local state for form
    const [formData, setFormData] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [missingAvatarSources, setMissingAvatarSources] = useState<string[]>([]);
    const [spriteUrl, setSpriteUrl] = useState<string | null>(null);

    const predefinedAvatars = [
        { role: 'OFICINA', label: 'OFICINA', path: 'sprite:OFICINA', fallback: '/assets/img/avatars/avatar_oficina.svg' },
        { role: 'GESTOR', label: 'GESTOR', path: 'sprite:GESTOR', fallback: '/assets/img/avatars/avatar_gestor.svg' },
        { role: 'ADMINISTRADOR', label: 'ADMINISTRADOR', path: 'sprite:ADMINISTRADOR', fallback: '/assets/img/avatars/avatar_admin.svg' },
        { role: 'SUPERVISOR', label: 'SUPERVISOR', path: 'sprite:SUPERVISOR', fallback: '/assets/img/avatars/avatar_supervisor.svg' },
        { role: 'MOTORISTA', label: 'MOTORISTA', path: 'sprite:MOTORISTA', fallback: '/assets/img/avatars/avatar_motorista.svg' },
        { role: 'COLABORADOR', label: 'COLABORADOR', path: 'sprite:COLABORADOR', fallback: '/assets/img/avatars/avatar_colaborador.svg' }
    ];

    const spritePositions: Record<string, string> = {
        OFICINA: '0% 0%',
        GESTOR: '50% 0%',
        ADMINISTRADOR: '100% 0%',
        SUPERVISOR: '0% 100%',
        MOTORISTA: '50% 100%',
        COLABORADOR: '100% 100%'
    };

    const isSpriteAvatar = (value: string) => value.startsWith('sprite:');
    const getSpriteRole = (value: string) => value.replace('sprite:', '').toUpperCase();

    const spriteCandidates = [
        '/AVATARES.PNG',
        '/avatares.png',
        '/assets/img/avatars/AVATARES.PNG',
        '/assets/img/avatars/avatares.png',
        '/avatars/AVATARES.PNG',
        '/avatars/avatares.png'
    ];

    const normalizeRoleForAvatar = (role?: string | null) => {
        const normalized = String(role || '').toUpperCase();
        if (normalized.includes('OFICINA')) return 'OFICINA';
        if (normalized.includes('GESTOR')) return 'GESTOR';
        if (normalized.includes('ADMIN')) return 'ADMINISTRADOR';
        if (normalized.includes('SUPERVISOR')) return 'SUPERVISOR';
        if (normalized.includes('MOTORISTA')) return 'MOTORISTA';
        return 'COLABORADOR';
    };

    const getDefaultAvatarForRole = (role?: string | null) => {
        const mappedRole = normalizeRoleForAvatar(role);
        return predefinedAvatars.find(a => a.role === mappedRole)?.path || 'sprite:COLABORADOR';
    };

    const getDisplayAvatarSrc = (avatarPath: string) => {
        const option = predefinedAvatars.find(a => a.path === avatarPath);
        if (!option) return avatarPath;
        return missingAvatarSources.includes(avatarPath) ? option.fallback : (spriteUrl || option.fallback);
    };

    const resolveCurrentAvatar = () => {
        const existing =
            (formData as any)?.avatar ||
            (formData as any)?.avatar_url ||
            (formData as any)?.foto ||
            (currentUser as any)?.avatar ||
            (currentUser as any)?.avatar_url ||
            (currentUser as any)?.foto;
        return existing || getDefaultAvatarForRole((currentUser as any)?.role || userRole);
    };

    const handleAvatarImageError = (avatarPath: string) => {
        setMissingAvatarSources((prev) => (prev.includes(avatarPath) ? prev : [...prev, avatarPath]));
    };

    const renderAvatar = (avatarValue: string, alt: string, extraClass = '') => {
        if (isSpriteAvatar(avatarValue) && spriteUrl && !missingAvatarSources.includes(avatarValue)) {
            const role = getSpriteRole(avatarValue);
            return (
                <div
                    className={`profile-avatar ${extraClass}`.trim()}
                    title={alt}
                    style={{
                        backgroundImage: `url('${spriteUrl}')`,
                        backgroundSize: '300% 200%',
                        backgroundPosition: spritePositions[role] || spritePositions.COLABORADOR,
                        backgroundRepeat: 'no-repeat'
                    }}
                />
            );
        }

        const fallback = predefinedAvatars.find(a => a.path === avatarValue)?.fallback || '/assets/img/avatars/avatar_colaborador.svg';
        const finalSrc = isSpriteAvatar(avatarValue) ? fallback : avatarValue;
        return (
            <img
                src={finalSrc}
                alt={alt}
                className={`profile-avatar ${extraClass}`.trim()}
            />
        );
    };

    const setAvatarInForm = (avatarValue: string) => {
        setFormData((prev: any) => ({
            ...prev,
            avatar: avatarValue,
            avatar_url: avatarValue,
            foto: avatarValue
        }));
    };

    const uploadAvatarToStorage = async (file: File) => {
        const userId = (currentUser as any)?.id || 'user';
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `img/users/${userId}_${Date.now()}_${cleanName}`;
        const candidateBuckets = ['assets', 'public'];

        for (const bucket of candidateBuckets) {
            const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
            if (!error) {
                const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
                if (data?.publicUrl) return data.publicUrl;
            }
        }

        return null;
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Selecione um ficheiro de imagem valido.' });
            return;
        }

        const uploadedUrl = await uploadAvatarToStorage(file);
        if (uploadedUrl) {
            setAvatarInForm(uploadedUrl);
            setMessage({ type: 'success', text: 'Foto carregada com sucesso.' });
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = String(reader.result || '');
            if (!base64) return;
            setAvatarInForm(base64);
            setMessage({ type: 'success', text: 'Preview atualizado (fallback local).' });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleSelectPredefinedAvatar = (avatarPath: string) => {
        setAvatarInForm(avatarPath);
        setShowAvatarModal(false);
    };

    const persistAvatarChoice = async (avatarValue: string) => {
        const userId = (currentUser as any)?.id;
        if (!userId) return;

        const roleNormalized = String(userRole || '').toLowerCase();

        // Legacy table may not exist in all environments.
        const legacyUsersUpdate = await supabase.from('users').update({ avatar: avatarValue }).eq('id', userId);
        if (legacyUsersUpdate.error) {
            const msg = String(legacyUsersUpdate.error.message || '').toLowerCase();
            const isMissingLegacyTable =
                msg.includes("relation 'users' does not exist") ||
                msg.includes('relation "users" does not exist');
            if (!isMissingLegacyTable) {
                throw legacyUsersUpdate.error;
            }
        }

        if (roleNormalized === 'motorista') {
            await supabase.from('motoristas').update({ foto: avatarValue }).eq('id', userId);
            return;
        }
        if (roleNormalized === 'supervisor') {
            await supabase.from('supervisores').update({ foto: avatarValue }).eq('id', userId);
            return;
        }
        if (roleNormalized === 'oficina') {
            await supabase.from('oficina_users').update({ foto: avatarValue }).eq('id', userId);
            return;
        }
        if (roleNormalized === 'gestor') {
            await supabase.from('gestores').update({ foto: avatarValue }).eq('id', userId);
            return;
        }

        const userProfileAvatarTry = await supabase
            .from('user_profiles')
            .update({ avatar: avatarValue, foto: avatarValue })
            .eq('id', userId);

        if (userProfileAvatarTry.error) {
            const message = String(userProfileAvatarTry.error.message || '').toLowerCase();
            const hasMissingAvatarColumn = message.includes("column 'avatar' does not exist") || message.includes('column "avatar" does not exist');
            const hasMissingFotoColumn = message.includes("column 'foto' does not exist") || message.includes('column "foto" does not exist');

            if (hasMissingAvatarColumn || hasMissingFotoColumn) {
                const fallbackNameOnly = await supabase.from('user_profiles').update({ nome: formData.nome || null }).eq('id', userId);
                if (fallbackNameOnly.error) {
                    throw fallbackNameOnly.error;
                }
                return;
            }

            throw userProfileAvatarTry.error;
        }
    };

    const persistProfileBasics = async () => {
        const userId = (currentUser as any)?.id;
        if (!userId) return;

        const basePayload: Record<string, any> = {
            nome: formData.nome || null,
            email: formData.email || null
        };

        const { error } = await supabase
            .from('user_profiles')
            .update(basePayload)
            .eq('id', userId);

        if (!error) return;

        const msg = String(error.message || '').toLowerCase();
        const hasMissingEmailColumn = msg.includes("column 'email' does not exist") || msg.includes('column "email" does not exist');
        if (hasMissingEmailColumn) {
            const fallback = await supabase
                .from('user_profiles')
                .update({ nome: formData.nome || null })
                .eq('id', userId);
            if (fallback.error) throw fallback.error;
            return;
        }

        throw error;
    };

    // Initialize data
    useEffect(() => {
        if (currentUser) {
            const computedAvatar =
                (currentUser as any).avatar ||
                (currentUser as any).avatar_url ||
                (currentUser as any).foto ||
                getDefaultAvatarForRole((currentUser as any).role || userRole);

            setFormData({
                ...currentUser,
                // Normalize fields
                telemovel: (currentUser as any).telemovel || (currentUser as any).contacto || '',
                password: (currentUser as any).password || '',
                avatar: computedAvatar,
                avatar_url: computedAvatar,
                foto: computedAvatar
            });
        }
    }, [currentUser, userRole]);

    useEffect(() => {
        let mounted = true;

        const resolveSprite = async () => {
            for (const candidate of spriteCandidates) {
                const exists = await new Promise<boolean>((resolve) => {
                    const image = new Image();
                    image.onload = () => resolve(true);
                    image.onerror = () => resolve(false);
                    image.src = `${candidate}?v=1`;
                });

                if (exists) {
                    if (mounted) setSpriteUrl(candidate);
                    return;
                }
            }

            if (mounted) setSpriteUrl(null);
        };

        void resolveSprite();

        return () => {
            mounted = false;
        };
    }, []);

    // Clear messages after 3s
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const avatarToSave = resolveCurrentAvatar();

            if (userRole === 'motorista') {
                await updateMotorista({
                    ...currentUser, // Keep existing fields
                    nome: formData.nome,
                    email: formData.email,
                    contacto: formData.telemovel,
                    cartaConducao: formData.cartaConducao,
                    pin: formData.pin,
                    foto: avatarToSave
                } as any);
            } else if (userRole === 'supervisor') {
                await updateSupervisor({
                    ...currentUser,
                    nome: formData.nome,
                    email: formData.email,
                    telemovel: formData.telemovel,
                    pin: formData.pin,
                    password: formData.password,
                    foto: avatarToSave
                } as any);
            } else if (userRole === 'oficina') {
                await updateOficinaUser({
                    ...currentUser,
                    nome: formData.nome,
                    email: formData.email,
                    telemovel: formData.telemovel,
                    pin: formData.pin,
                    foto: avatarToSave
                } as any);
            } else if (userRole === 'admin') {
                // Admin updates via Supabase Auth only when needed.
                const authPayload: {
                    email?: string;
                    password?: string;
                    data?: Record<string, any>;
                } = {
                    data: {
                        full_name: formData.nome || undefined,
                        nome: formData.nome || undefined
                    }
                };

                if (formData.email && formData.email !== (currentUser as any)?.email) {
                    authPayload.email = formData.email;
                }

                if (formData.password) {
                    authPayload.password = formData.password;
                }

                if (authPayload.email || authPayload.password) {
                    const { error } = await supabase.auth.updateUser(authPayload);
                    if (error) throw error;
                }
            }

            await persistProfileBasics();
            await persistAvatarChoice(avatarToSave);
            updateUserPhoto(avatarToSave);

            await refreshCurrentUser();
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Erro ao atualizar: ' + (error.message || 'Tente novamente.') });
        } finally {
            setIsLoading(false);
        }
    };

    const roleLabel = String((currentUser as any)?.role || userRole || '').toUpperCase();
    const department = (currentUser as any)?.departamento || (currentUser as any)?.department || 'Operacoes';
    const username = (formData as any)?.username || (currentUser as any)?.username || (currentUser as any)?.email?.split('@')?.[0] || '';
    const language = (formData as any)?.language || (currentUser as any)?.language || 'pt-PT';
    const timezone = (formData as any)?.timezone || (currentUser as any)?.timezone || 'Europe/Lisbon';
    const sessionLocation =
        (currentUser as any)?.session_location ||
        (currentUser as any)?.currentSessionLocation ||
        'Algarve, PT';
    const permissions = [
        'Centro Operacional',
        'Escalas',
        'Motoristas',
        'Viaturas',
        'Combustivel',
        'Relatorios',
        'Administracao'
    ];
    const recentActivity = [
        'Hoje 11:02 - Editou viatura',
        'Hoje 10:21 - Criou escala',
        'Ontem 18:40 - Exportou relatorio'
    ];

    const resolveLastLogin = () => {
        const raw =
            (currentUser as any)?.last_login_at ||
            (currentUser as any)?.lastLoginAt ||
            (currentUser as any)?.last_sign_in_at ||
            (currentUser as any)?.updatedAt ||
            (currentUser as any)?.createdAt;
        if (!raw) return 'Sem registo';
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return 'Sem registo';

        const today = new Date();
        const sameDay =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
        const dayLabel = sameDay ? 'hoje' : date.toLocaleDateString('pt-PT');
        const hourLabel = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        return `${dayLabel} ${hourLabel}`;
    };

    if (!currentUser) return null;

    return (
        <div className="w-full min-w-0 space-y-6 animate-in fade-in duration-500">
            <div className="p-4 md:p-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <aside className="xl:col-span-4">
                        <div className="bg-[#0f172a] border border-slate-200 rounded-2xl p-6 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
                            <div className="flex flex-col items-start gap-4">
                                {resolveCurrentAvatar() ? (
                                    renderAvatar(resolveCurrentAvatar(), formData.nome || 'Utilizador')
                                ) : (
                                    <div className="profile-avatar bg-white/90 flex items-center justify-center">
                                        <UserCircle2 className="w-10 h-10 text-slate-500" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-slate-900 leading-tight truncate">{formData.nome || 'Utilizador'}</h2>
                                    <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        <Shield className="w-3 h-3" />
                                        {roleLabel}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-white/90 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload photo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAvatarModal(true)}
                                    className="w-full bg-white/90 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Images className="w-4 h-4" />
                                    Choose predefined avatar
                                </button>
                            </div>

                            <div className="mt-6 space-y-3 text-sm">
                                <div>
                                    <p className="text-slate-500 uppercase tracking-wider text-[11px]">Departamento</p>
                                    <p className="text-slate-200 font-semibold">{department}</p>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Clock3 className="w-4 h-4" />
                                    <p className="text-sm">Ultimo acesso: {resolveLastLogin()}</p>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <MapPin className="w-4 h-4" />
                                    <p className="text-sm">Sessao atual: {sessionLocation}</p>
                                </div>
                            </div>

                            <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
                                <p className="text-slate-500 uppercase tracking-wider text-[11px]">Permissoes</p>
                                <div className="flex flex-wrap gap-2">
                                    {permissions.map((permission) => (
                                        <span
                                            key={permission}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-200"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            {permission}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    <section className="xl:col-span-8">
                        <form onSubmit={handleSave} className="bg-[#0f172a] border border-slate-200 rounded-2xl p-6 md:p-8 space-y-8 relative shadow-[0_8px_18px_-12px_rgba(15,23,42,0.22)]">
                            <input type="hidden" id="selectedAvatar" name="avatar" value={resolveCurrentAvatar()} readOnly />

                            {message && (
                                <div className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-center gap-2 text-sm font-bold animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    {message.text}
                                </div>
                            )}

                            <div className="space-y-5">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <User className="w-5 h-5 text-blue-500" />
                                    Informacoes Pessoais
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Nome completo</label>
                                        <input
                                            type="text"
                                            value={formData.nome || ''}
                                            onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Email</label>
                                        <div className="relative">
                                            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <input
                                                type="email"
                                                value={formData.email || ''}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Telefone</label>
                                        <div className="relative">
                                            <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <input
                                                type="tel"
                                                value={formData.telemovel || ''}
                                                onChange={e => setFormData({ ...formData, telemovel: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Username</label>
                                        <div className="relative">
                                            <UserCircle2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Idioma</label>
                                        <div className="relative">
                                            <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <select
                                                value={language}
                                                onChange={e => setFormData({ ...formData, language: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                            >
                                                <option value="pt-PT">Portugues (PT)</option>
                                                <option value="en-GB">English (UK)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Fuso horario</label>
                                        <div className="relative">
                                            <Clock3 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <select
                                                value={timezone}
                                                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                            >
                                                <option value="Europe/Lisbon">Europe/Lisbon</option>
                                                <option value="Europe/Madrid">Europe/Madrid</option>
                                                <option value="UTC">UTC</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 pt-1">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <Key className="w-5 h-5 text-amber-500" />
                                    Seguranca
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">PIN de acesso</label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={formData.pin || ''}
                                            onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                            className="w-full bg-white/90 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-mono tracking-widest text-center focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                                            placeholder="000000"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-400">Alterar password</label>
                                        <div className="relative">
                                            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                            <input
                                                type="password"
                                                value={formData.password || ''}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full bg-white/90 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                                                placeholder="Nova password"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white/90 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-slate-400">Sessoes ativas</p>
                                            <p className="text-sm font-semibold text-slate-900">1 sessao atual</p>
                                        </div>
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Ativa</span>
                                    </div>

                                    <label className="bg-white/90 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer">
                                        <div>
                                            <p className="text-xs font-medium text-slate-400">Autenticacao de 2 fatores</p>
                                            <p className="text-sm font-semibold text-slate-900">Ativar 2FA (opcional)</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={Boolean((formData as any).twoFactorEnabled)}
                                            onChange={e => setFormData({ ...formData, twoFactorEnabled: e.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 bg-slate-100 text-blue-500 focus:ring-blue-500"
                                        />
                                    </label>

                                    <div className="bg-white/90 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium text-slate-400">Dispositivos autorizados</p>
                                            <p className="text-sm font-semibold text-slate-900">Web Chrome (este dispositivo)</p>
                                        </div>
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Confiavel</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-1">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <Clock3 className="w-5 h-5 text-blue-500" />
                                    Atividade recente
                                </h3>
                                <div className="space-y-2">
                                    {recentActivity.map((item) => (
                                        <div key={item} className="bg-white/90 border border-slate-200 rounded-xl px-4 py-3">
                                            <p className="text-sm text-slate-200">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            A processar...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Gravar Alteracoes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>

            {showAvatarModal && (
                <div className="fixed inset-0 z-[7000] bg-white/75 backdrop-blur-sm p-4 flex items-center justify-center">
                    <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-200 rounded-2xl p-6 md:p-8">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-slate-900">Selecionar Avatar por Função</h3>
                            <button
                                type="button"
                                onClick={() => setShowAvatarModal(false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {predefinedAvatars.map((avatar) => {
                                const isSelected = resolveCurrentAvatar() === avatar.path;
                                return (
                                    <button
                                        type="button"
                                        key={avatar.role}
                                        onClick={() => handleSelectPredefinedAvatar(avatar.path)}
                                        data-avatar={avatar.path}
                                        className={`avatar-option bg-white/90 border rounded-xl p-4 text-left transition-colors ${isSelected ? 'selected border-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={isSpriteAvatar(avatar.path) ? (spriteUrl || avatar.fallback) : getDisplayAvatarSrc(avatar.path)}
                                                alt={avatar.label}
                                                className="hidden"
                                                onError={() => handleAvatarImageError(avatar.path)}
                                            />
                                            {renderAvatar(avatar.path, avatar.label)}
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{avatar.label}</p>
                                                <p className="text-xs text-slate-400">Algartempo Frota</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
