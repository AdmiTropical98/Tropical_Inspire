import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { Message, Conversation, MessageType } from '../types';

interface ChatContextType {
    // Messages
    messages: Message[];
    sendMessage: (content: string, receiverId: string, type?: MessageType, metadata?: any) => void;
    markAsRead: (senderId: string) => void;
    markConversationAsRead: (conversationId: string) => void;

    // Conversations
    conversations: Conversation[];
    currentConversationId: string | null;
    setCurrentConversationId: (id: string | null) => void;
    getConversationList: () => Conversation[];
    getConversationMessages: (participantId: string) => Message[];

    // Unread tracking
    unreadCount: number;
    getUnreadCountForUser: (userId: string) => number;
    hasUnreadMessages: boolean;

    // Settings
    notificationSound: boolean;
    setNotificationSound: (enabled: boolean) => void;

    // Quick actions
    sendQuickAction: (receiverId: string, actionType: 'location' | 'service' | 'presence' | 'alert', data?: any) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { userRole, currentUser } = useAuth();

    const safeInit = <T,>(key: string, defaultVal: T): T => {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return defaultVal;
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? (parsed as T) : defaultVal;
        } catch (error) {
            console.error(`Error loading ${key} from localStorage`, error);
            return defaultVal;
        }
    };

    const [messages, setMessages] = useState<Message[]>(() => safeInit('chat_messages', []));
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [notificationSound, setNotificationSound] = useState(() => safeInit('notification_sound', true));

    const myId = userRole === 'admin' ? 'admin' : currentUser?.id || 'unknown';

    // Persist messages
    useEffect(() => {
        localStorage.setItem('chat_messages', JSON.stringify(messages));
    }, [messages]);

    // Persist notification settings
    useEffect(() => {
        localStorage.setItem('notification_sound', JSON.stringify(notificationSound));
    }, [notificationSound]);

    // Cross-tab sync
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'chat_messages' && e.newValue) {
                try {
                    setMessages(JSON.parse(e.newValue));
                } catch (err) {
                    console.error('Error syncing messages', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Build conversations from messages
    useEffect(() => {
        const conversationMap = new Map<string, Conversation>();

        messages.forEach(msg => {
            const participantId = msg.senderId === myId ? msg.receiverId : msg.senderId;
            const isSent = msg.senderId === myId;

            if (!conversationMap.has(participantId)) {
                conversationMap.set(participantId, {
                    id: participantId,
                    participantId,
                    participantName: msg.senderName || msg.senderId,
                    participantRole: (msg.senderRole || 'motorista') as any,
                    unreadCount: 0,
                    isOnline: true,
                    lastSeen: new Date().toISOString(),
                });
            }

            const conversation = conversationMap.get(participantId)!;
            conversation.lastMessage = msg.content;
            conversation.lastMessageTime = msg.timestamp;

            if (!isSent && !msg.read) {
                conversation.unreadCount++;
            }
        });

        setConversations(Array.from(conversationMap.values()).sort((a, b) => {
            const aTime = new Date(a.lastMessageTime || 0).getTime();
            const bTime = new Date(b.lastMessageTime || 0).getTime();
            return bTime - aTime;
        }));
    }, [messages, myId]);

    const sendMessage = useCallback((content: string, receiverId: string, type: MessageType = 'normal', metadata?: any) => {
        const newMessage: Message = {
            id: crypto.randomUUID(),
            senderId: myId,
            senderName: currentUser?.nome || 'You',
            senderRole: userRole as any,
            receiverId,
            content,
            timestamp: new Date().toISOString(),
            read: false,
            type,
            metadata,
        };
        setMessages(prev => [...prev, newMessage]);

        // Play notification sound if enabled
        if (notificationSound) {
            playNotificationSound();
        }
    }, [myId, currentUser, userRole, notificationSound]);

    const markAsRead = useCallback((senderId: string) => {
        setMessages(prev => prev.map(msg =>
            (msg.senderId === senderId && msg.receiverId === myId && !msg.read)
                ? { ...msg, read: true }
                : msg
        ));
    }, [myId]);

    const markConversationAsRead = useCallback((conversationId: string) => {
        setMessages(prev => prev.map(msg =>
            (msg.senderId === conversationId && msg.receiverId === myId && !msg.read)
                ? { ...msg, read: true }
                : msg
        ));
    }, [myId]);

    const getConversationMessages = useCallback((participantId: string) => {
        return messages.filter(m =>
            (m.senderId === myId && m.receiverId === participantId) ||
            (m.senderId === participantId && m.receiverId === myId)
        );
    }, [messages, myId]);

    const unreadCount = messages.filter(m => m.receiverId === myId && !m.read).length;
    const hasUnreadMessages = unreadCount > 0;

    const getUnreadCountForUser = (userId: string) => {
        return messages.filter(m => m.senderId === userId && m.receiverId === myId && !m.read).length;
    };

    const sendQuickAction = useCallback((receiverId: string, actionType: 'location' | 'service' | 'presence' | 'alert', data?: any) => {
        let content = '';
        const messageType: MessageType = actionType === 'alert' ? 'alerta' : 'operacional';

        switch (actionType) {
            case 'location':
                content = `📍 Localização partilhada: ${data?.address || 'Localização atual'}`;
                break;
            case 'service':
                content = `🚐 Serviço atribuído: ${data?.serviceName || 'Novo serviço'}`;
                break;
            case 'presence':
                content = `✅ Presença confirmada às ${data?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                break;
            case 'alert':
                content = `⚠️ ALERTA OPERACIONAL: ${data?.message || 'Alerta enviado'}`;
                break;
        }

        sendMessage(content, receiverId, messageType, { actionType, ...data });
    }, [sendMessage]);

    return (
        <ChatContext.Provider value={{
            messages,
            sendMessage,
            markAsRead,
            markConversationAsRead,
            conversations,
            currentConversationId,
            setCurrentConversationId,
            getConversationList: () => conversations,
            getConversationMessages,
            unreadCount,
            hasUnreadMessages,
            getUnreadCountForUser,
            notificationSound,
            setNotificationSound,
            sendQuickAction,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}

// Utility: Play notification sound
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.debug('Notification sound not available', error);
    }
}
