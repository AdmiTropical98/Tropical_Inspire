import { useMemo } from 'react';
import { Search, Shield, Wrench, User, MessageCircle, Loader } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';

interface ConversationListProps {
    selectedConversationId: string | null;
    onSelectConversation: (id: string) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

export default function ConversationList({
    selectedConversationId,
    onSelectConversation,
    searchTerm,
    onSearchChange,
}: ConversationListProps) {
    const { contacts, loadingContacts, selectContact, getUnreadCountForUser } = useChat();

    // Filter contacts based on search
    const filteredContacts = useMemo(() => {
        if (!searchTerm.trim()) return contacts;

        return contacts.filter(contact =>
            contact.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [contacts, searchTerm]);

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-blue-500/10 border-blue-500 text-blue-400';
            case 'supervisor':
                return 'bg-purple-500/10 border-purple-500 text-purple-400';
            case 'oficina':
                return 'bg-orange-500/10 border-orange-500 text-orange-400';
            case 'gestor':
                return 'bg-indigo-500/10 border-indigo-500 text-indigo-400';
            default:
                return 'bg-emerald-500/10 border-emerald-500 text-emerald-400';
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin':
                return <Shield className="w-5 h-5" />;
            case 'oficina':
                return <Wrench className="w-5 h-5" />;
            default:
                return <User className="w-5 h-5" />;
        }
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case 'admin':
                return 'ADMIN';
            case 'supervisor':
                return 'SUPERVISOR';
            case 'oficina':
                return 'OFICINA';
            case 'gestor':
                return 'GESTOR';
            default:
                return 'MOTORISTA';
        }
    };

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Search Bar */}
            <div className="shrink-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-3">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Procurar contacto..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-blue-500/50 outline-none transition-colors"
                    />
                </div>

                {/* Filter pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap cursor-pointer hover:bg-blue-500 transition-colors">
                        Todos ({filteredContacts.length})
                    </span>
                    <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors">
                        Motoristas
                    </span>
                    <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-400 border border-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors">
                        Equipa
                    </span>
                </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 min-h-0 bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3 overflow-y-auto custom-scrollbar space-y-2">
                {loadingContacts ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <Loader className="w-8 h-8 text-blue-500 mb-2 animate-spin" />
                        <p className="text-sm text-slate-500">A carregar contactos...</p>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <MessageCircle className="w-8 h-8 text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500">Nenhum contacto encontrado</p>
                    </div>
                ) : (
                    filteredContacts.map((contact) => {
                        const unreadCount = getUnreadCountForUser(contact.id);
                        const isSelected = selectedConversationId === contact.id;

                        return (
                            <button
                                key={contact.id}
                                onClick={() => {
                                    selectContact(contact.id);
                                    onSelectConversation(contact.id);
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border group
                                ${isSelected
                                    ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-800/20 border-transparent hover:bg-slate-800/60 hover:border-slate-700/30'
                                }`}
                            >
                                {/* Avatar with Role Badge */}
                                <div className="relative shrink-0">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-bold text-lg
                                        ${getRoleBadgeColor(contact.role)}
                                    `}>
                                        {getRoleIcon(contact.role)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 text-left min-w-0">
                                    {/* Name */}
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-200'} truncate`}>
                                            {contact.nome}
                                        </span>
                                    </div>

                                    {/* Email Preview */}
                                    <p className="text-xs text-slate-500 truncate mb-1 line-clamp-1">
                                        {contact.email}
                                    </p>

                                    {/* Role and Unread Badge */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                                            {getRoleName(contact.role)}
                                        </span>
                                        {unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse min-w-fit">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
