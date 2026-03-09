import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AtSign,
    Bell,
    Car,
    FileText,
    MessageSquare,
    Paperclip,
    Plus,
    Search,
    Send,
    User,
    Users,
    Wrench,
    Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkshop } from '../../contexts/WorkshopContext';

type ConversationType = 'team' | 'vehicle' | 'private' | 'system';
type OperationalStatus = 'disponivel' | 'em_servico' | 'a_abastecer' | 'em_oficina' | 'indisponivel';

interface CommConversationRow {
    id: string;
    type: ConversationType;
    name: string;
    vehicle_id?: string | null;
    team_code?: string | null;
    created_at: string;
    updated_at?: string | null;
    last_message_at?: string | null;
}

interface CommParticipant {
    conversation_id: string;
    user_id: string;
    user_name?: string | null;
    user_role?: string | null;
    last_read_at?: string | null;
}

interface CommMessage {
    id: string;
    conversation_id: string;
    user_id?: string | null;
    message?: string | null;
    content?: string | null;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_mime?: string | null;
    mentions?: string[] | null;
    read_by?: string[] | null;
    source?: 'user' | 'system' | null;
    created_at: string;
    metadata?: Record<string, any> | null;
}

interface OperationalUser {
    id: string;
    name: string;
    role: 'motorista' | 'supervisor' | 'oficina' | 'admin' | 'gestor';
    estadoOperacional?: OperationalStatus;
}

interface DraftAttachment {
    dataUrl: string;
    name: string;
    mime: string;
}

const STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
    { value: 'disponivel', label: 'Disponivel' },
    { value: 'em_servico', label: 'Em servico' },
    { value: 'a_abastecer', label: 'A abastecer' },
    { value: 'em_oficina', label: 'Em oficina' },
    { value: 'indisponivel', label: 'Indisponivel' }
];

const ROLE_LABEL: Record<string, string> = {
    motorista: 'Motorista',
    supervisor: 'Supervisor',
    oficina: 'Oficina',
    admin: 'Admin',
    gestor: 'Gestor'
};

const roleIcon = (role: string) => {
    if (role === 'motorista') return <Car className="w-4 h-4 text-cyan-400" />;
    if (role === 'supervisor') return <Shield className="w-4 h-4 text-purple-400" />;
    if (role === 'oficina') return <Wrench className="w-4 h-4 text-orange-400" />;
    if (role === 'gestor') return <Users className="w-4 h-4 text-emerald-400" />;
    return <User className="w-4 h-4 text-blue-400" />;
};

const normalizePlate = (plate?: string | null) => (plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const nowIso = () => new Date().toISOString();

export default function ChatPage() {
    const { currentUser, userRole } = useAuth();
    const {
        motoristas,
        supervisors,
        oficinaUsers,
        viaturas,
        fuelTransactions,
        updateMotorista
    } = useWorkshop();

    const myId = currentUser?.id || '';

    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [conversations, setConversations] = useState<CommConversationRow[]>([]);
    const [participantsByConversation, setParticipantsByConversation] = useState<Record<string, CommParticipant[]>>({});
    const [messagesByConversation, setMessagesByConversation] = useState<Record<string, CommMessage[]>>({});
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    const [draft, setDraft] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
    const [attachment, setAttachment] = useState<DraftAttachment | null>(null);

    const [privateTargetId, setPrivateTargetId] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const operationalUsers = useMemo<OperationalUser[]>(() => {
        const list: OperationalUser[] = [];

        motoristas.forEach((m) => {
            const role = (m.tipoUtilizador || (m as any).tipo_utilizador || 'motorista') as OperationalUser['role'];
            list.push({
                id: m.id,
                name: m.nome,
                role,
                estadoOperacional: m.estadoOperacional || (m as any).estado_operacional || 'disponivel'
            });
        });

        supervisors.forEach((s) => list.push({ id: s.id, name: s.nome, role: 'supervisor' }));
        oficinaUsers.forEach((o) => list.push({ id: o.id, name: o.nome, role: 'oficina' }));

        if (myId && !list.some((u) => u.id === myId)) {
            const normalizedRole = (['motorista', 'supervisor', 'oficina', 'gestor'].includes(String(userRole))
                ? (userRole as OperationalUser['role'])
                : 'admin');
            list.push({ id: myId, name: (currentUser as any)?.nome || 'Utilizador Atual', role: normalizedRole });
        }

        return list;
    }, [motoristas, supervisors, oficinaUsers, myId, userRole, currentUser]);

    const selectedConversation = useMemo(
        () => conversations.find((c) => c.id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const selectedMessages = useMemo(
        () => (selectedConversationId ? messagesByConversation[selectedConversationId] || [] : []),
        [messagesByConversation, selectedConversationId]
    );

    const conversationCards = useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations
            .map((c) => {
                const msgs = messagesByConversation[c.id] || [];
                const lastMessage = msgs[msgs.length - 1];
                const unreadCount = msgs.filter((m) => {
                    const readBy = m.read_by || [];
                    return m.user_id !== myId && !readBy.includes(myId);
                }).length;

                return {
                    ...c,
                    unreadCount,
                    lastMessageText: lastMessage?.message || lastMessage?.content || '',
                    lastMessageTime: lastMessage?.created_at || c.last_message_at || c.created_at
                };
            })
            .filter((c) => {
                if (!q) return true;
                return (
                    c.name.toLowerCase().includes(q) ||
                    c.lastMessageText.toLowerCase().includes(q) ||
                    (c.type || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    }, [conversations, messagesByConversation, search, myId]);

    const mentionSuggestions = useMemo(() => {
        if (!mentionQuery.trim()) return [];
        return operationalUsers
            .filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
            .slice(0, 8);
    }, [mentionQuery, operationalUsers]);

    const refreshConversationData = async () => {
        setLoading(true);
        try {
            const { data: convRows, error: convError } = await supabase
                .from('conversations')
                .select('*')
                .order('last_message_at', { ascending: false, nullsFirst: false });

            if (convError) throw convError;

            const convs = (convRows || []) as CommConversationRow[];
            setConversations(convs);

            if (convs.length === 0) {
                setParticipantsByConversation({});
                setMessagesByConversation({});
                setSelectedConversationId(null);
                return;
            }

            const convIds = convs.map((c) => c.id);

            const [partsRes, msgsRes] = await Promise.all([
                supabase
                    .from('conversation_participants')
                    .select('*')
                    .in('conversation_id', convIds),
                supabase
                    .from('messages')
                    .select('*')
                    .in('conversation_id', convIds)
                    .order('created_at', { ascending: true })
            ]);

            if (partsRes.error) throw partsRes.error;
            if (msgsRes.error) throw msgsRes.error;

            const participants = (partsRes.data || []) as CommParticipant[];
            const groupedParticipants: Record<string, CommParticipant[]> = {};
            participants.forEach((p) => {
                if (!groupedParticipants[p.conversation_id]) groupedParticipants[p.conversation_id] = [];
                groupedParticipants[p.conversation_id].push(p);
            });

            const groupedMessages: Record<string, CommMessage[]> = {};
            ((msgsRes.data || []) as CommMessage[]).forEach((m) => {
                if (!groupedMessages[m.conversation_id]) groupedMessages[m.conversation_id] = [];
                groupedMessages[m.conversation_id].push({
                    ...m,
                    mentions: Array.isArray(m.mentions) ? m.mentions : []
                });
            });

            setParticipantsByConversation(groupedParticipants);
            setMessagesByConversation(groupedMessages);

            if (!selectedConversationId || !convs.some((c) => c.id === selectedConversationId)) {
                setSelectedConversationId(convs[0].id);
            }
        } catch (error) {
            console.error('Erro ao carregar central de comunicacoes:', error);
        } finally {
            setLoading(false);
        }
    };

    const ensureParticipants = async (conversationId: string, users: OperationalUser[]) => {
        if (!users.length) return;
        await supabase.from('conversation_participants').upsert(
            users.map((u) => ({
                conversation_id: conversationId,
                user_id: u.id,
                user_name: u.name,
                user_role: u.role
            })),
            { onConflict: 'conversation_id,user_id' }
        );
    };

    const ensureConversation = async (args: {
        type: ConversationType;
        name: string;
        teamCode?: string;
        vehicleId?: string;
        participants: OperationalUser[];
    }) => {
        let query = supabase.from('conversations').select('id').eq('type', args.type);

        if (args.type === 'team') query = query.eq('team_code', args.teamCode || '');
        if (args.type === 'vehicle') query = query.eq('vehicle_id', args.vehicleId || '');
        if (args.type === 'system') query = query.eq('name', args.name);

        const { data: existing } = await query.limit(1).maybeSingle();

        let conversationId = existing?.id as string | undefined;

        if (!conversationId) {
            const { data: inserted, error } = await supabase
                .from('conversations')
                .insert({
                    type: args.type,
                    name: args.name,
                    team_code: args.teamCode || null,
                    vehicle_id: args.vehicleId || null,
                    user_id: myId || null,
                    participant_id: null,
                    last_message_at: nowIso()
                })
                .select('id')
                .single();

            if (error) {
                console.error('Erro ao criar conversa:', error);
                return;
            }
            conversationId = inserted.id;
        }

        if (conversationId) {
            await ensureParticipants(conversationId, args.participants);
        }
    };

    const ensureBaseConversations = async () => {
        if (!myId || operationalUsers.length === 0) return;

        const motoristasUsers = operationalUsers.filter((u) => u.role === 'motorista');
        const supervisoresUsers = operationalUsers.filter((u) => u.role === 'supervisor');
        const oficinaTeamUsers = operationalUsers.filter((u) => u.role === 'oficina');

        await ensureConversation({
            type: 'system',
            name: 'Alertas do Sistema',
            participants: operationalUsers
        });

        await ensureConversation({
            type: 'team',
            name: 'Equipa Motoristas',
            teamCode: 'motoristas',
            participants: motoristasUsers.length ? motoristasUsers : operationalUsers
        });

        await ensureConversation({
            type: 'team',
            name: 'Equipa Supervisores',
            teamCode: 'supervisores',
            participants: supervisoresUsers.length ? supervisoresUsers : operationalUsers
        });

        await ensureConversation({
            type: 'team',
            name: 'Equipa Oficina',
            teamCode: 'oficina',
            participants: oficinaTeamUsers.length ? oficinaTeamUsers : operationalUsers
        });

        for (const v of viaturas) {
            await ensureConversation({
                type: 'vehicle',
                name: `Viatura ${v.matricula}`,
                vehicleId: v.id,
                participants: operationalUsers
            });
        }
    };

    const ensureSystemAlerts = async () => {
        const systemConversation = conversations.find((c) => c.type === 'system' && c.name === 'Alertas do Sistema');
        if (!systemConversation) return;

        const { data: existingMessages } = await supabase
            .from('messages')
            .select('id, metadata')
            .eq('conversation_id', systemConversation.id)
            .eq('source', 'system')
            .order('created_at', { ascending: false })
            .limit(600);

        const existingKeys = new Set(
            (existingMessages || [])
                .map((m: any) => m?.metadata?.event_key)
                .filter(Boolean)
        );

        const alertsToCreate: Array<{ key: string; text: string }> = [];

        const msDay = 24 * 60 * 60 * 1000;

        viaturas.forEach((v) => {
            const vehicleTx = fuelTransactions
                .filter((tx) => tx.vehicleId === v.id || normalizePlate(tx.vehicleId) === normalizePlate(v.matricula))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const latest = vehicleTx[0];
            const daysWithoutFuel = latest
                ? Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / msDay)
                : 999;

            if (daysWithoutFuel >= 10) {
                alertsToCreate.push({
                    key: `no_fuel_${v.id}_${daysWithoutFuel}`,
                    text: `Sistema: Viatura ${v.matricula} sem abastecimento ha ${daysWithoutFuel} dias.`
                });
            }

            if (v.estado === 'em_manutencao') {
                alertsToCreate.push({
                    key: `immobilized_${v.id}`,
                    text: `Sistema: Viatura ${v.matricula} encontra-se imobilizada/em manutencao.`
                });
            }
        });

        fuelTransactions
            .filter((tx) => tx.isAnormal)
            .slice(-20)
            .forEach((tx) => {
                alertsToCreate.push({
                    key: `abnormal_${tx.id}`,
                    text: `Sistema: Consumo anormal detetado no abastecimento ${tx.id}.`
                });
            });

        const inserts = alertsToCreate
            .filter((a) => !existingKeys.has(a.key))
            .map((a) => ({
                conversation_id: systemConversation.id,
                user_id: null,
                sender_id: null,
                message: a.text,
                content: a.text,
                source: 'system',
                type: 'sistema',
                metadata: { event_key: a.key },
                read_by: []
            }));

        if (inserts.length) {
            const { error } = await supabase.from('messages').insert(inserts);
            if (!error) {
                await supabase
                    .from('conversations')
                    .update({ updated_at: nowIso(), last_message_at: nowIso() })
                    .eq('id', systemConversation.id);
            }
        }
    };

    useEffect(() => {
        let mounted = true;

        (async () => {
            await ensureBaseConversations();
            if (mounted) await refreshConversationData();
        })();

        const conversationsChannel = supabase
            .channel('comm-center-conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
                refreshConversationData();
            })
            .subscribe();

        const messagesChannel = supabase
            .channel('comm-center-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                refreshConversationData();
            })
            .subscribe();

        const participantsChannel = supabase
            .channel('comm-center-participants')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => {
                refreshConversationData();
            })
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(conversationsChannel);
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(participantsChannel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myId, operationalUsers.length, viaturas.length]);

    useEffect(() => {
        if (!conversations.length) return;
        ensureSystemAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversations.length, viaturas, fuelTransactions]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedMessages.length, selectedConversationId]);

    const markConversationAsRead = async (conversationId: string) => {
        if (!myId) return;
        const msgs = messagesByConversation[conversationId] || [];
        const unread = msgs.filter((m) => m.user_id !== myId && !(m.read_by || []).includes(myId));
        if (!unread.length) return;

        await Promise.all(
            unread.map((m) =>
                supabase
                    .from('messages')
                    .update({ read_by: [...(m.read_by || []), myId] })
                    .eq('id', m.id)
            )
        );
    };

    useEffect(() => {
        if (!selectedConversationId) return;
        markConversationAsRead(selectedConversationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedConversationId, selectedMessages.length]);

    const upsertPrivateConversation = async () => {
        if (!privateTargetId || !myId) return;
        const target = operationalUsers.find((u) => u.id === privateTargetId);
        if (!target) return;

        const { data: existingParticipants } = await supabase
            .from('conversation_participants')
            .select('conversation_id, user_id')
            .in('user_id', [myId, target.id]);

        const counts: Record<string, number> = {};
        (existingParticipants || []).forEach((row: any) => {
            counts[row.conversation_id] = (counts[row.conversation_id] || 0) + 1;
        });

        const possibleConversationIds = Object.keys(counts).filter((id) => counts[id] >= 2);
        if (possibleConversationIds.length) {
            const { data: conv } = await supabase
                .from('conversations')
                .select('*')
                .in('id', possibleConversationIds)
                .eq('type', 'private')
                .limit(1)
                .maybeSingle();

            if (conv?.id) {
                setSelectedConversationId(conv.id);
                setPrivateTargetId('');
                return;
            }
        }

        const { data: inserted, error } = await supabase
            .from('conversations')
            .insert({
                type: 'private',
                name: `Privado: ${(currentUser as any)?.nome || 'Eu'} / ${target.name}`,
                user_id: myId,
                participant_id: null,
                last_message_at: nowIso()
            })
            .select('id')
            .single();

        if (error || !inserted) {
            console.error('Erro ao criar conversa privada:', error);
            return;
        }

        await ensureParticipants(inserted.id, [
            {
                id: myId,
                name: (currentUser as any)?.nome || 'Utilizador Atual',
                role: (['motorista', 'supervisor', 'oficina', 'gestor'].includes(String(userRole)) ? userRole : 'admin') as any
            },
            target
        ]);

        setPrivateTargetId('');
        await refreshConversationData();
        setSelectedConversationId(inserted.id);
    };

    const onDraftChange = (value: string) => {
        setDraft(value);

        const mentionMatch = value.match(/@([^\s@]*)$/);
        setMentionQuery(mentionMatch ? mentionMatch[1] : '');
    };

    const insertMention = (u: OperationalUser) => {
        setDraft((prev) => prev.replace(/@([^\s@]*)$/, `@${u.name} `));
        setMentionQuery('');
        setSelectedMentions((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    };

    const onPickAttachment = () => {
        fileInputRef.current?.click();
    };

    const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setAttachment({
                dataUrl: String(reader.result || ''),
                name: file.name,
                mime: file.type || 'application/octet-stream'
            });
        };
        reader.readAsDataURL(file);

        if (event.target) event.target.value = '';
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedConversationId) return;
        if (!draft.trim() && !attachment) return;

        const text = draft.trim();
        const createdAt = nowIso();

        const payload: Record<string, any> = {
            conversation_id: selectedConversationId,
            user_id: myId || null,
            sender_id: null,
            message: text || (attachment ? `[Anexo] ${attachment.name}` : ''),
            content: text || (attachment ? `[Anexo] ${attachment.name}` : ''),
            attachment_url: attachment?.dataUrl || null,
            attachment_name: attachment?.name || null,
            attachment_mime: attachment?.mime || null,
            mentions: selectedMentions,
            read_by: myId ? [myId] : [],
            source: 'user',
            type: 'operacional',
            metadata: {
                mentions: selectedMentions,
                attachment_name: attachment?.name || null
            },
            created_at: createdAt
        };

        const { error } = await supabase.from('messages').insert(payload);

        if (error) {
            console.error('Erro ao enviar mensagem:', error);
            return;
        }

        await supabase
            .from('conversations')
            .update({ updated_at: createdAt, last_message_at: createdAt })
            .eq('id', selectedConversationId);

        setDraft('');
        setAttachment(null);
        setSelectedMentions([]);
    };

    const senderName = (message: CommMessage) => {
        if (message.source === 'system' || !message.user_id) return 'Sistema';

        const list = selectedConversationId ? participantsByConversation[selectedConversationId] || [] : [];
        const participant = list.find((p) => p.user_id === message.user_id);
        if (participant?.user_name) return participant.user_name;

        const opUser = operationalUsers.find((u) => u.id === message.user_id);
        return opUser?.name || 'Utilizador';
    };

    const selectedVehicleContext = useMemo(() => {
        if (!selectedConversation || selectedConversation.type !== 'vehicle' || !selectedConversation.vehicle_id) {
            return null;
        }

        const vehicle = viaturas.find((v) => v.id === selectedConversation.vehicle_id);
        if (!vehicle) return null;

        const vehicleTx = fuelTransactions
            .filter((tx) => tx.vehicleId === vehicle.id || normalizePlate(tx.vehicleId) === normalizePlate(vehicle.matricula))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const lastTx = [...vehicleTx].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        let consumoMedio = 'N/D';
        if (vehicleTx.length >= 2) {
            const kmStart = Number(vehicleTx[0].km || 0);
            const kmEnd = Number(vehicleTx[vehicleTx.length - 1].km || 0);
            const totalLiters = vehicleTx.reduce((acc, tx) => acc + Number(tx.liters || 0), 0);
            const distance = kmEnd - kmStart;
            if (distance > 0) {
                consumoMedio = `${((totalLiters / distance) * 100).toFixed(2)} L/100km`;
            }
        }

        const currentDriver = motoristas.find(
            (m) => normalizePlate(m.currentVehicle) === normalizePlate(vehicle.matricula)
        );

        return { vehicle, lastTx, consumoMedio, currentDriver };
    }, [selectedConversation, viaturas, fuelTransactions, motoristas]);

    const selectedUserContext = useMemo(() => {
        if (!selectedConversation) return null;
        const participants = participantsByConversation[selectedConversation.id] || [];
        const target = participants.find((p) => p.user_id !== myId) || participants[0];
        if (!target) return null;

        const user = operationalUsers.find((u) => u.id === target.user_id);
        if (!user) return { id: target.user_id, name: target.user_name || 'Utilizador', role: target.user_role || 'utilizador' };
        return user;
    }, [selectedConversation, participantsByConversation, operationalUsers, myId]);

    const updateSelectedDriverStatus = async (status: OperationalStatus) => {
        if (!selectedUserContext || !('id' in selectedUserContext)) return;
        const motorista = motoristas.find((m) => m.id === (selectedUserContext as any).id);
        if (!motorista) return;
        await updateMotorista({ ...motorista, estadoOperacional: status });
    };

    return (
        <div className="h-full bg-[#0f172a] text-white p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Central de Comunicacoes
                    </h1>
                    <p className="text-slate-400 text-sm">Centro operacional em tempo real para frota e equipas</p>
                </div>
            </div>

            <div className="h-[calc(100vh-170px)] grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-3 bg-[#1e293b]/45 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-slate-700/50 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Pesquisar conversas"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500/60"
                            />
                        </div>

                        <div className="flex gap-2">
                            <select
                                value={privateTargetId}
                                onChange={(e) => setPrivateTargetId(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs"
                            >
                                <option value="">Nova conversa privada</option>
                                {operationalUsers
                                    .filter((u) => u.id !== myId)
                                    .map((u) => (
                                        <option key={u.id} value={u.id}>{u.name} ({ROLE_LABEL[u.role] || u.role})</option>
                                    ))}
                            </select>
                            <button
                                onClick={upsertPrivateConversation}
                                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold"
                                title="Criar conversa privada"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {loading && <p className="text-xs text-slate-500 p-2">A carregar...</p>}
                        {!loading && conversationCards.length === 0 && (
                            <p className="text-xs text-slate-500 p-2">Sem conversas.</p>
                        )}

                        {conversationCards.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedConversationId(c.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedConversationId === c.id
                                    ? 'bg-blue-600/15 border-blue-500/50'
                                    : 'bg-slate-800/30 border-transparent hover:bg-slate-800/55'
                                    }`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm truncate">{c.name}</p>
                                        <p className="text-[11px] text-slate-400 uppercase">{c.type}</p>
                                    </div>
                                    {c.unreadCount > 0 && (
                                        <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{c.unreadCount}</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-2 line-clamp-1">{c.lastMessageText || 'Sem mensagens'}</p>
                                <p className="text-[10px] text-slate-500 mt-1">{new Date(c.lastMessageTime).toLocaleString()}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="xl:col-span-6 bg-[#1e293b]/45 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                    {selectedConversation ? (
                        <>
                            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between gap-3 bg-slate-900/55">
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold truncate">{selectedConversation.name}</h2>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider">{selectedConversation.type}</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-950/25">
                                {selectedMessages.length === 0 && (
                                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-500">
                                        <MessageSquare className="w-8 h-8 mb-2" />
                                        <p className="text-sm">Ainda sem mensagens nesta conversa.</p>
                                    </div>
                                )}

                                {selectedMessages.map((m) => {
                                    const mine = m.user_id === myId;
                                    const text = m.message || m.content || '';
                                    const isImage = (m.attachment_mime || '').startsWith('image/');
                                    return (
                                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl p-3 border ${mine
                                                ? 'bg-blue-600/90 border-blue-500/70 text-white'
                                                : m.source === 'system'
                                                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-100'
                                                    : 'bg-slate-800/70 border-slate-700/60 text-slate-100'
                                                }`}>
                                                <div className="text-[10px] opacity-80 mb-1 font-semibold">{senderName(m)}</div>
                                                {text && <p className="text-sm whitespace-pre-wrap break-words">{text}</p>}

                                                {m.attachment_url && (
                                                    <div className="mt-2">
                                                        {isImage ? (
                                                            <img src={m.attachment_url} alt={m.attachment_name || 'imagem'} className="max-h-48 rounded-lg border border-slate-600/60" />
                                                        ) : (
                                                            <a
                                                                href={m.attachment_url}
                                                                download={m.attachment_name || 'anexo'}
                                                                className="inline-flex items-center gap-2 text-xs underline"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                {m.attachment_name || 'Anexo'}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="text-[10px] opacity-70 mt-2">{new Date(m.created_at).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={sendMessage} className="p-3 border-t border-slate-700/50 bg-slate-900/60 space-y-2">
                                {attachment && (
                                    <div className="flex items-center justify-between text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                                        <span className="truncate">{attachment.name}</span>
                                        <button type="button" onClick={() => setAttachment(null)} className="text-red-300">Remover</button>
                                    </div>
                                )}

                                <div className="flex items-end gap-2">
                                    <button type="button" onClick={onPickAttachment} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700" title="Anexar ficheiro">
                                        <Paperclip className="w-4 h-4" />
                                    </button>

                                    <div className="relative flex-1">
                                        <textarea
                                            value={draft}
                                            onChange={(e) => onDraftChange(e.target.value)}
                                            rows={2}
                                            placeholder="Escrever mensagem... Use @ para mencionar"
                                            className="w-full resize-none bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                                        />

                                        {mentionQuery && mentionSuggestions.length > 0 && (
                                            <div className="absolute bottom-full mb-2 left-0 w-full max-h-40 overflow-y-auto custom-scrollbar bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-20">
                                                {mentionSuggestions.map((u) => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => insertMention(u)}
                                                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 flex items-center gap-2"
                                                    >
                                                        <AtSign className="w-3 h-3 text-blue-400" />
                                                        <span className="truncate">{u.name}</span>
                                                        <span className="text-slate-500 ml-auto">{ROLE_LABEL[u.role] || u.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button type="submit" className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500" title="Enviar">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>

                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachmentChange} />
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <MessageSquare className="w-10 h-10 mb-2" />
                            <p>Seleciona uma conversa para abrir o chat.</p>
                        </div>
                    )}
                </div>

                <div className="xl:col-span-3 bg-[#1e293b]/45 border border-slate-700/50 rounded-2xl overflow-y-auto custom-scrollbar p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Contexto Operacional</h3>

                    {!selectedConversation && <p className="text-sm text-slate-500">Sem conversa selecionada.</p>}

                    {selectedConversation?.type === 'vehicle' && selectedVehicleContext && (
                        <div className="space-y-3 text-sm">
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Matricula</p>
                                <p className="font-bold">{selectedVehicleContext.vehicle.matricula}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Motorista atual</p>
                                <p className="font-bold">{selectedVehicleContext.currentDriver?.nome || 'Nao atribuido'}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Ultimo abastecimento</p>
                                <p className="font-bold">{selectedVehicleContext.lastTx ? `${selectedVehicleContext.lastTx.liters}L em ${new Date(selectedVehicleContext.lastTx.timestamp).toLocaleString()}` : 'Sem registo'}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Consumo medio</p>
                                <p className="font-bold">{selectedVehicleContext.consumoMedio}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Proxima revisao</p>
                                <p className="font-bold">{selectedVehicleContext.vehicle.estado === 'em_manutencao' ? 'Em manutencao' : 'N/D'}</p>
                            </div>
                        </div>
                    )}

                    {selectedConversation && selectedConversation.type !== 'vehicle' && selectedUserContext && (
                        <div className="space-y-3 text-sm">
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs mb-1">Nome</p>
                                <p className="font-bold flex items-center gap-2">{roleIcon((selectedUserContext as any).role || 'admin')}{(selectedUserContext as any).name || 'Utilizador'}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Funcao</p>
                                <p className="font-bold">{ROLE_LABEL[(selectedUserContext as any).role] || (selectedUserContext as any).role || 'N/D'}</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs mb-2">Estado atual</p>
                                {((selectedUserContext as any).role === 'motorista' || (selectedUserContext as any).estadoOperacional) ? (
                                    <select
                                        value={(selectedUserContext as any).estadoOperacional || 'disponivel'}
                                        onChange={(e) => updateSelectedDriverStatus(e.target.value as OperationalStatus)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs"
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="font-bold">N/D</p>
                                )}
                            </div>

                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Notas</p>
                                <p className="text-xs text-slate-300 mt-1">Conversa operacional sincronizada em tempo real.</p>
                            </div>
                        </div>
                    )}

                    {selectedConversation?.type === 'system' && (
                        <div className="space-y-3 text-sm">
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Canal</p>
                                <p className="font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Alertas do Sistema</p>
                            </div>
                            <div className="bg-slate-800/45 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-slate-400 text-xs">Tipos de alerta</p>
                                <ul className="text-xs text-slate-300 mt-1 space-y-1">
                                    <li>- Viatura sem abastecimento</li>
                                    <li>- Consumo anormal</li>
                                    <li>- Viatura imobilizada</li>
                                </ul>
                            </div>
                            <button
                                onClick={ensureSystemAlerts}
                                className="w-full px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold"
                            >
                                Atualizar alertas automaticamente
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
