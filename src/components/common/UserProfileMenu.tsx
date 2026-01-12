import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Check, Camera, User } from 'lucide-react';
import ImageCropper from './ImageCropper';

interface UserProfileMenuProps {
    onNavigate?: () => void;
}

export default function UserProfileMenu({ onNavigate }: UserProfileMenuProps) {
    const { userRole, currentUser, logout, userStatus, updateStatus, language, setLanguage, userPhoto, updateUserPhoto } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get User Details for Display
    const getInitials = () => {
        if (userRole === 'admin') return 'A';
        if (currentUser?.nome) return currentUser.nome.charAt(0).toUpperCase();
        return 'U';
    };

    const getDisplayName = () => {
        return currentUser?.nome || (userRole === 'admin' ? 'Administrador' : 'Utilizador');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-emerald-500';
            case 'absent': return 'bg-amber-500';
            case 'offline': return 'bg-red-500';
            default: return 'bg-emerald-500';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'online': return language === 'pt' ? 'Online' : 'Online';
            case 'absent': return language === 'pt' ? 'Ausente' : 'Away';
            case 'offline': return language === 'pt' ? 'Offline' : 'Offline';
            default: return 'Online';
        }
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempImage(reader.result as string);
                // Clear input so same file can be selected again if cancelled
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropComplete = (croppedBase64: string) => {
        updateUserPhoto(croppedBase64);
        setTempImage(null);
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleProfileClick = () => {
        setIsOpen(false);
        if (onNavigate) onNavigate();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {tempImage && (
                <ImageCropper
                    imageSrc={tempImage}
                    onCancel={() => setTempImage(null)}
                    onCropComplete={handleCropComplete}
                />
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors group"
            >
                {/* Status Badge */}
                <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border bg-opacity-10 
                    ${userStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        userStatus === 'absent' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            'bg-red-500/10 border-red-500/20 text-red-500'}
                `}>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(userStatus)} ${userStatus === 'online' ? 'animate-pulse' : ''}`}></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{getStatusLabel(userStatus)}</span>
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 overflow-hidden border border-white/10">
                    {userPhoto ? (
                        <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        getInitials()
                    )}
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-4 w-64 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">

                    {/* Header */}
                    <div className="p-3 mb-2 border-b border-slate-700/50 flex items-center gap-3">
                        <div className="relative group/avatar cursor-pointer" onClick={triggerFileInput}>
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-600 group-hover/avatar:border-blue-500 transition-colors">
                                {userPhoto ? (
                                    <img src={userPhoto} alt="Big Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-slate-400">{getInitials()}</span>
                                )}

                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                    <Camera className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                            />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">{getDisplayName()}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{userRole}</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="mb-2">
                        <button
                            onClick={handleProfileClick}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors mb-1"
                        >
                            <User className="w-4 h-4 text-blue-400" />
                            <span>Meu Perfil</span>
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 my-2 mx-3"></div>

                    {/* Status Selection */}
                    <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500">Estado</p>
                        <button onClick={() => updateStatus('online')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span>Online</span>
                            </div>
                            {userStatus === 'online' && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                        <button onClick={() => updateStatus('absent')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span>Ausente</span>
                            </div>
                            {userStatus === 'absent' && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                        <button onClick={() => updateStatus('offline')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span>Offline</span>
                            </div>
                            {userStatus === 'offline' && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 my-2 mx-3"></div>

                    {/* Language Selection */}
                    <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500">Idioma / Language</p>
                        <button onClick={() => setLanguage('pt')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🇵🇹</span>
                                <span>Português</span>
                            </div>
                            {language === 'pt' && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                        <button onClick={() => setLanguage('en')} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🇬🇧</span>
                                <span>English</span>
                            </div>
                            {language === 'en' && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                    </div>

                    <div className="h-px bg-slate-700/50 my-2 mx-3"></div>

                    {/* Logout */}
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Terminar Sessão
                    </button>
                </div>
            )}
        </div>
    );
}
