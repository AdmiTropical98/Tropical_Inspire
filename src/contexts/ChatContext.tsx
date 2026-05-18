import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { Message, Conversation, MessageType } from '../types';
import { supabase } from '../lib/supabase';

interface UserProfile {
    id: string;
    nome: string;
    email: string;
    role: string;
    status?: string;
}

interface ChatContextType {
    // Users/Contacts
    contacts: UserProfile[];
    loadingContacts: boolean;

    // Messages
    messages: Message[];
    sendMessage: (content: string, receiverId: string, type?: MessageType, metadata?: any) => Promise<void>;
    markAsRead: (senderId: string) => void;
    markConversationAsRead: (conversationId: string) => void;

    // Conversations
    conversations: Conversation[];
    currentConversationId: string | null;
    setCurrentConversationId: (id: string | null) => void;
    getConversationList: () => Conversation[];
    getConversationMessages: (participantId: string) => Message[];
    selectContact: (userId: string) => Promise<void>;

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

    const [contacts, setContacts] = useState<UserProfile[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [notificationSound, setNotificationSound] = useState(() => safeInit('notification_sound', true));

    const myId = currentUser?.id || 'unknown';

    // Load contacts from user_profiles table
    useEffect(() => {
        const loadContacts = async () => {
            try {
                setLoadingContacts(true);
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, nome, email, role, status')
                    .eq('status', 'ACTIVE')
                    .order('nome', { ascending: true });

                if (error) {
                    console.error('Error loading contacts:', error);
                } else if (data) {
                    // Filter out current user
                    const filtered = data.filter(u => u.id !== myId);
                    setContacts(filtered);
                }
            } catch (err) {
                console.error('Error loading contacts:', err);
            } finally {
                setLoadingContacts(false);
            }
        };

        if (myId && myId !== 'unknown') {
            loadContacts();
        }
    }, [myId]);

    // Persist notification settings
    useEffect(() => {
        localStorage.setItem('notification_sound', JSON.stringify(notificationSound));
    }, [notificationSound]);

    const sendMessage = useCallback(async (content: string, receiverId: string, type: MessageType = 'normal', metadata?: any) => {
        try {
            // Find or create conversation
            let conversationId: string | null = null;
            const existingConv = conversations.find(
                c => (c.participantId === receiverId)
            );

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                // Create new conversation
                const { data, error } = await supabase
                    .from('conversations')
                    .insert([
                        {
                            user_id: myId,
                            participant_id: receiverId,
                        }
                    ])
                    .select()
                    .single();

                if (error) {
                    console.error('Error creating conversation:', error);
                    return;
                }
                conversationId = data.id;
            }

            if (!conversationId) return;

            // Insert message
            const { error: msgError } = await supabase
                .from('messages')
                .insert([
                    {
                        conversation_id: conversationId,
                        sender_id: myId,
                        content,
                        type,
                        metadata,
                    }
                ]);

            if (msgError) {
                console.error('Error sending message:', msgError);
            }

            // Create local message for immediate display
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
        } catch (err) {
            console.error('Error in sendMessage:', err);
        }
    }, [myId, currentUser, userRole, notificationSound, conversations]);

    const selectContact = useCallback(async (userId: string) => {
        try {
            // Check if conversation exists
            let conversationId: string | null = null;
            
            const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user_id.eq.${myId},participant_id.eq.${userId}),and(user_id.eq.${userId},participant_id.eq.${myId})`)
                .single();

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                // Create new conversation
                const { data, error } = await supabase
                    .from('conversations')
                    .insert([
                        {
                            user_id: myId,
                            participant_id: userId,
                        }
                    ])
                    .select()
                    .single();

                if (error) {
                    console.error('Error creating conversation:', error);
                    return;
                }
                conversationId = data.id;
            }

            if (conversationId) {
                setCurrentConversationId(userId);
                // Load messages for this conversation
                const { data: messages } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });

                if (messages) {
                    // Convert to local message format
                    const localMessages = messages.map(msg => ({
                        id: msg.id,
                        senderId: msg.sender_id,
                        senderName: undefined,
                        senderRole: undefined,
                        receiverId: userId,
                        content: msg.content,
                        timestamp: msg.created_at,
                        read: msg.read,
                        type: msg.type as MessageType,
                        metadata: msg.metadata,
                    }));
                    setMessages(localMessages);
                }
            }
        } catch (err) {
            console.error('Error selecting contact:', err);
        }
    }, [myId]);

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
            contacts,
            loadingContacts,
            messages,
            sendMessage,
            markAsRead,
            markConversationAsRead,
            conversations,
            currentConversationId,
            setCurrentConversationId,
            getConversationList: () => conversations,
            getConversationMessages,
            selectContact,
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
