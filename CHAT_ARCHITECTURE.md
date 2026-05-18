# Central de Mensagens - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CHAT APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      ChatPage Container                       │   │
│  │                                                               │   │
│  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  │ Conversation   │  │  Chat Window     │  │ Quick Actions  │  │
│  │  │ List           │  │                  │  │ Panel          │  │
│  │  │ ─────────────  │  │ ──────────────── │  │ ────────────── │  │
│  │  │ • Search       │  │ • Message List   │  │ • 4 Buttons    │  │
│  │  │ • Filters      │  │ • 4 Message      │  │ • Status Card  │  │
│  │  │ • List Items   │  │   Types          │  │ • Collapsible  │  │
│  │  │   - Avatar     │  │ • Input Area     │  │                │  │
│  │  │   - Name       │  │ • Quick          │  │ (Desktop Only) │  │
│  │  │   - Last Msg   │  │   Shortcuts      │  │                │  │
│  │  │   - Time       │  │ • Send Button    │  │                │  │
│  │  │   - Unread     │  │                  │  │                │  │
│  │  │   - Online     │  │                  │  │                │  │
│  │  │   - Role       │  │                  │  │                │  │
│  │  └────────────────┘  └──────────────────┘  └────────────────┘  │
│  │                                                                   │
│  │  Responsive Grid:                                                │
│  │  Desktop (1024px+):  4 cols  │  6 cols  │  2 cols              │
│  │  Tablet (768px+):    ◀── SWAPPABLE ──────────────────────►     │
│  │  Mobile (<768px):    ◀────────── Single Column ─────────────►   │
│  │                                                                   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

                            │
                            ▼

┌─────────────────────────────────────────────────────────────────────┐
│                    DATA MANAGEMENT LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │            ChatContext (useChat hook)                      │    │
│  │                                                            │    │
│  │  State:                   Methods:                        │    │
│  │  • messages[]             • sendMessage()                 │    │
│  │  • conversations[]        • sendQuickAction()             │    │
│  │  • currentConvID          • markAsRead()                  │    │
│  │  • notificationSound      • markConversationAsRead()      │    │
│  │                          • setCurrentConversationId()     │    │
│  │                          • getConversationMessages()      │    │
│  │                          • setNotificationSound()         │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │         AUTO-COMPUTED (via useEffect)                      │    │
│  │                                                            │    │
│  │  Conversation[] = auto-generated from messages            │    │
│  │  • Sorted by lastMessageTime (newest first)               │    │
│  │  • Aggregates unreadCount per participant                 │    │
│  │  • Builds lastMessage preview                             │    │
│  │  • Tracks online status (simulated)                       │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

                            │
                            ▼

┌─────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  LocalStorage (Browser)                                             │
│  ├─ chat_messages: Message[]                                        │
│  │  └─ Persists all messages as JSON                               │
│  │                                                                   │
│  └─ notification_sound: boolean                                     │
│     └─ Remembers user notification preference                       │
│                                                                       │
│  (Phase 2: Migrate to Supabase Realtime)                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

                            │
                            ▼

┌─────────────────────────────────────────────────────────────────────┐
│                  CONTEXT PROVIDERS (Not visible to user)            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  • AuthContext        → User ID, Role                               │
│  • WorkshopContext    → Motoristas, Supervisors, OficinaUsers       │
│  • PermissionsContext → Role-based display controls                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Message Type System

```
┌────────────────────────────────────────────────────────┐
│                  MESSAGE TYPE SYSTEM                   │
├────────────────────────────────────────────────────────┤
│                                                         │
│  NORMAL (Default)                                      │
│  ├─ Type: 'normal'                                    │
│  ├─ User: 💬 Blue bubble                             │
│  ├─ Other: 💬 Grey bubble                            │
│  └─ Use: Casual conversation                          │
│                                                         │
│  OPERACIONAL (Operations)                              │
│  ├─ Type: 'operacional'                              │
│  ├─ Badge: ⚙️ OPERACIONAL                            │
│  ├─ Color: Blue ring + blue highlight                │
│  └─ Use: Fleet operations, schedules                  │
│                                                         │
│  ALERTA (Alert)                                       │
│  ├─ Type: 'alerta'                                   │
│  ├─ Badge: ⚠️ ALERTA                                 │
│  ├─ Color: Orange/Red ring + orange highlight         │
│  └─ Use: Urgent situations, anomalies                 │
│                                                         │
│  SISTEMA (System)                                     │
│  ├─ Type: 'sistema'                                  │
│  ├─ Badge: 🤖 SISTEMA                                │
│  ├─ Color: Grey italic for automation                │
│  └─ Use: Auto-generated confirmations                 │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Component Composition Tree

```
ChatPage (Main Container)
│
├─ Header
│  └─ Unread Badge (conditional)
│
└─ Grid Layout (4 cols | 6 cols | 2 cols)
   │
   ├─ ConversationList (left)
   │  ├─ Search Bar
   │  │  ├─ Input field
   │  │  └─ Clear on input
   │  │
   │  ├─ Filter Pills
   │  │  ├─ Todos
   │  │  ├─ Motoristas
   │  │  └─ Equipa
   │  │
   │  └─ Conversations (scrollable)
   │     └─ ConversationItem (repeated)
   │        ├─ Avatar
   │        ├─ Name + Role Badge
   │        ├─ Last Message Preview
   │        ├─ Timestamp
   │        ├─ Unread Badge (conditional)
   │        └─ Online Indicator
   │
   ├─ ChatWindow (center)
   │  ├─ Header
   │  │  ├─ Back Button (mobile-only)
   │  │  ├─ Avatar
   │  │  ├─ Name + Online Status
   │  │  └─ Call/Video Buttons
   │  │
   │  ├─ Messages Area (scrollable)
   │  │  └─ Message Items (repeated)
   │  │     ├─ Type Badge (conditional)
   │  │     ├─ Content
   │  │     ├─ Timestamp
   │  │     └─ Read Status (own only)
   │  │
   │  ├─ Quick Shortcuts (collapsible)
   │  │  ├─ Toggle Button
   │  │  └─ Expanded Set (4 buttons)
   │  │     ├─ Location
   │  │     ├─ Service
   │  │     ├─ Presence
   │  │     └─ Alert
   │  │
   │  └─ Input Area
   │     ├─ Text Input
   │     └─ Send Button
   │
   └─ QuickActionsPanel (right, desktop-only)
      ├─ Toggle Button
      ├─ Contact Info
      └─ Collapsed/Expanded State
         ├─ 4 Action Buttons
         │  ├─ Ver Perfil
         │  ├─ Ver Escalas
         │  ├─ Ver Viatura
         │  └─ Enviar Alerta
         └─ Status Card
```

## Data Flow Diagram

```
USER INTERACTIONS
│
├─ Type Message
│  └─ Input change event
│     └─ setInputMessage()
│        └─ Component state update
│           └─ Input reflects text
│
├─ Send Message
│  └─ Form submit
│     └─ handleSendMessage()
│        └─ sendMessage() [context]
│           └─ Create Message object
│              ├─ id (UUID)
│              ├─ senderId
│              ├─ receiverId
│              ├─ content
│              ├─ timestamp
│              ├─ read (false)
│              ├─ type (default: 'normal')
│              └─ metadata (optional)
│                 └─ Add to messages array
│                    └─ useState updates [messages, setMessages]
│                       └─ useEffect triggers
│                          ├─ localStorage.setItem() [persist]
│                          └─ Auto-generate conversations
│                             σ Rebuild conversations array
│                             └─ useState updates [conversations, setConversations]
│                                └─ ConversationList re-renders
│                                   └─ Show in list with unread badge
│                                └─ ChatWindow re-renders
│                                   └─ New message appears in chat
│
├─ Select Conversation
│  └─ Button click
│     └─ handleSelectConversation()
│        ├─ setCurrentConversationId() [context]
│        ├─ setShowMobileChat(true) [mobile only]
│        └─ markAsRead() [context]
│           └─ Update message.read = true
│              └─ setState([cleaned messages])
│                 └─ Unread badges disappear
│                    └─ ConversationList updates highlight
│                       └─ ChatWindow loads messages for conversation
│                          └─ getConversationMessages() filters
│                          └─ Display in order
│
├─ Quick Action
│  └─ Button click
│     └─ onShortcutClick()
│        └─ handleQuickAction()
│           └─ sendQuickAction() [context]
│              └─ Build action message
│                 ├─ Select emoji + text format
│                 └─ sendMessage() with type + metadata
│                    └─ Auto-generates message
│                       └─ Appears in chat with type styling
│
└─ Search
   └─ Input change
      └─ onSearchChange()
         └─ setSearchTerm()
            └─ Pass to ConversationList
               └─ useMemo filters conversations
                  └─ List updates with matches
```

## State Hierarchy

```
ChatContext (Global)
│
├── messages: Message[]
│   ├─ Persisted to localStorage
│   ├─ Updated on sendMessage()
│   ├─ Updated on markAsRead()
│   └─ Triggers conversation rebuild
│
├── conversations: Conversation[] (auto-computed)
│   ├─ Built from messages in useEffect
│   ├─ Sorted by lastMessageTime
│   ├─ Pre-calculated unreadCount
│   └─ Updated when messages change
│
├── currentConversationId: string | null
│   ├─ Set by setCurrentConversationId()
│   ├─ Used to filter ChatWindow messages
│   └─ Determines selected highlight in list
│
├── notificationSound: boolean
│   ├─ Default: true
│   ├─ Persisted to localStorage
│   ├─ Toggled by setNotificationSound()
│   ├─ Checked before playNotificationSound()
│   └─ User preference remembered
│
└─ Derived/Computed
   ├── unreadCount: number
   │   └─ Computed from messages.filter(m => !m.read && m.receiverId === myId)
   │
   ├── hasUnreadMessages: boolean
   │   └─ Computed from unreadCount > 0
   │
   └── getUnreadCountForUser(userId): number
       └─ Computed from messages by senderId
```

## Responsive Grid Layout

```
DESKTOP (1024px+)
┌────────────────┬──────────────────────┬─────────────────┐
│                │                      │                 │
│   4 COLUMNS    │    6 COLUMNS         │   2 COLUMNS     │
│ Conversation   │  Chat Window         │ Quick Actions   │
│ List           │  + Quick Shortcuts   │ Panel           │
│                │                      │ (collapsible)   │
│                │                      │                 │
└────────────────┴──────────────────────┴─────────────────┘

TABLET (768px - 1024px)
┌────────────┬──────────────────────────┐
│            │                          │
│ 4 COLUMNS  │  8 COLUMNS               │
│Conv. List  │  Chat Window             │
│            │  (Quick Actions hidden)  │
│            │                          │
└────────────┴──────────────────────────┘

MOBILE (<768px)
┌──────────────────┐
│                  │
│ Conversation     │
│ List             │
│ (VISIBLE)        │
│                  │
├──────────────────┤
│                  │
│ Chat Window      │
│ (HIDDEN until    │
│  selected,       │
│  showMobileChat  │
│  = true)         │
│                  │
└──────────────────┘
```

## Message Styling Matrix

```
TYPE         │ OWN STYLE              │ OTHER STYLE            │ ICON/BADGE
─────────────┼────────────────────────┼────────────────────────┼─────────────
NORMAL       │ bg-blue-600            │ bg-slate-800           │ None
             │ text-white             │ border-slate-700       │
             │ rounded-br-none        │ rounded-bl-none        │
─────────────┼────────────────────────┼────────────────────────┼─────────────
OPERACIONAL  │ bg-blue-600            │ bg-blue-600/20         │ ⚙️
             │ text-white             │ border-blue-500/40     │ OPERACIONAL
             │ rounded-br-none        │ ring-blue-500/20       │ (blue)
─────────────┼────────────────────────┼────────────────────────┼─────────────
ALERTA       │ bg-blue-600            │ bg-orange-600/20       │ ⚠️
             │ text-white             │ border-orange-500/40   │ ALERTA
             │ rounded-br-none        │ ring-orange-500/20     │ (orange)
─────────────┼────────────────────────┼────────────────────────┼─────────────
SISTEMA      │ bg-blue-600            │ bg-slate-700/30        │ 🤖
             │ text-white             │ border-slate-600/40    │ SISTEMA
             │ rounded-br-none        │ italic text-slate-300  │ (grey)
```

## Color Palette

```
ROLE COLORS
┌──────────┬──────────────────┬──────────────────┐
│ ADMIN    │ bg-blue-500/10   │ border-blue-500  │
│          │ text-blue-400    │                  │
├──────────┼──────────────────┼──────────────────┤
│ SUPERVISOR│ bg-purple-500/10 │ border-purple-500│
│          │ text-purple-400  │                  │
├──────────┼──────────────────┼──────────────────┤
│ OFICINA  │ bg-orange-500/10 │ border-orange-500│
│          │ text-orange-400  │                  │
├──────────┼──────────────────┼──────────────────┤
│ GESTOR   │ bg-indigo-500/10 │ border-indigo-500│
│          │ text-indigo-400  │                  │
├──────────┼──────────────────┼──────────────────┤
│ MOTORISTA│ bg-emerald-500/10│ border-emerald-500
│          │ text-emerald-400 │                  │
└──────────┴──────────────────┴──────────────────┘

MESSAGE TYPE COLORS (for non-owner)
┌────────────┬──────────────────┬──────────────────┐
│ OPERACIONAL│ bg-blue-600/20   │ ring-blue-500/20 │
│            │ border-blue-500/40                  │
├────────────┼──────────────────┼──────────────────┤
│ ALERTA     │ bg-orange-600/20 │ ring-orange-500/20
│            │ border-orange-500/40                │
├────────────┼──────────────────┼──────────────────┤
│ SISTEMA    │ bg-slate-700/30  │ ring-0           │
│            │ border-slate-600/40                 │
└────────────┴──────────────────┴──────────────────┘
```

## Event Flow Example: Send Message

```
User Types "Olá"
    ↓
onChange event fires
    ↓
setInputMessage("Olá")
    ↓
Value prop updates [re-render]
    ↓
User Clicks Send Button
    ↓
onSubmit event fires
    ↓
handleSend() called
    ↓
e.preventDefault()
    ↓
if (!inputMessage.trim()) return
    ↓
onSendMessage(inputMessage) [callback from parent]
    ↓
handleSendMessage("Olá") [ChatPage]
    ↓
sendMessage("Olá", currentConversationId) [context method]
    ↓
Create Message object:
{
    id: crypto.randomUUID(),
    senderId: myId,
    senderName: currentUser.nome,
    senderRole: userRole,
    receiverId: currentConversationId,
    content: "Olá",
    timestamp: new Date().toISOString(),
    read: false,
    type: 'normal'
}
    ↓
setMessages(prev => [...prev, newMessage])
    ↓
[React re-renders]
    ↓
useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages))
}, [messages])
    ↓
[Messages persisted]
    ↓
useEffect(() => {
    // Rebuild conversations
    setConversations(newConversations)
}, [messages])
    ↓
[ConversationList re-renders]
    ├─ Shows updated lastMessage
    ├─ Updates lastMessageTime
    └─ Reorders by recency
    ↓
[ChatWindow re-renders]
    ├─ Appends new message
    ├─ Message appears in view
    └─ Auto-scrolls to bottom
    ↓
setInputMessage("")  // Clear input
    ↓
User sees message in chat!
```

---

This architecture provides:
- **Separation of concerns** (UI / Logic / State)
- **Type safety** (Full TypeScript)
- **Scalability** (Easy to extend)
- **Performance** (Memoized computations)
- **Responsiveness** (Mobile-first grid)
- **Persistence** (LocalStorage + Cross-tab sync)
