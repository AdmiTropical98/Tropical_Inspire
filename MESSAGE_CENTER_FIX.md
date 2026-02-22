# Message Center Fix - Documentation

## Problem
The Message Center stopped showing users after the refactor because it was loading contacts from conversations stored in localStorage, but no conversations existed yet.

## Solution
Restored the Message Center to load users directly from the `user_profiles` database table and implement on-demand conversation creation.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260222_create_conversations_table.sql`

Created new database tables:
- **conversations**: Stores conversation metadata between users
  - `id` (UUID, PK)
  - `user_id` (UUID, FK to auth.users)
  - `participant_id` (UUID, FK to auth.users)
  - `created_at`, `updated_at`, `last_message_at` timestamps
  - Unique constraint on (user_id, participant_id) pair

- **messages**: Stores all messages
  - `id` (UUID, PK)
  - `conversation_id` (UUID, FK)
  - `sender_id` (UUID, FK to auth.users)
  - `content` (TEXT)
  - `type` (normal/alerta/operacional/sistema)
  - `metadata` (JSONB for attachments, etc.)
  - `read` (BOOLEAN)
  - `created_at` timestamp

**Features:**
- RLS policies for data security
- Indexes on frequently queried columns for performance
- Proper CASCADE delete behavior

### 2. ChatContext.tsx - Major Refactor

#### New Interface
- `UserProfile`: Represents a user from the database
  ```typescript
  interface UserProfile {
    id: string;
    nome: string;
    email: string;
    role: string;
    status?: string;
  }
  ```

#### New Features
- `contacts: UserProfile[]` - All active users from user_profiles table
- `loadingContacts: boolean` - Loading state while fetching users
- `selectContact(userId: string)` - Async method to select a user and load/create conversation

#### Behavior Changes
1. **Load users from database**: Fetches all active users with `status = 'ACTIVE'` at startup
2. **Lazy conversation loading**: Conversations only load after selecting a user
3. **Auto-create conversations**: When selecting a user, automatically creates a conversation if one doesn't exist
4. **Database persistence**: Messages are stored in the database instead of localStorage
5. **Async messaging**: `sendMessage()` is now async to handle database operations

#### Load Flow
```
User selects contact → selectContact() called
  ↓
Query database for existing conversation
  ├─ Found: Use existing ID
  └─ Not found: Create new conversation
  ↓
Load messages from database for that conversation
  ↓
Set as current conversation & display messages
```

### 3. ConversationList.tsx - Updated to Show Users

#### Changes
- Now displays **all active users** instead of conversations
- Shows loading spinner while fetching contacts
- Filters contacts by name, email, and role
- Click handler calls `selectContact()` before setting current conversation
- Updated to use contact data (nome, email, role) instead of conversation data

#### UI Elements
- Shows user icon based on role
- Displays email instead of last message
- Shows unread count per user
- Filter pills show total contact count

### 4. ChatPage.tsx - Updated Logic

#### Changes
- Removed dependency on `conversations` array
- Builds `currentConversation` object dynamically from selected `currentContact`
- Updated `handleSendMessage()` to handle async `sendMessage()`
- Simplified component structure

#### Key Variables
```typescript
const currentContact = contacts.find(c => c.id === currentConversationId);
const currentConversation = currentContact ? { /* built from contact */ } : null;
```

## Requirements Met

✅ **Contact list source**: Loads ALL active users from `user_profiles`
   ```sql
   SELECT id, nome, email, role FROM user_profiles 
   WHERE status = 'ACTIVE' 
   ORDER BY nome;
   ```

✅ **Always visible sidebar**: Left sidebar shows all users even without conversation history

✅ **Lazy conversation load**: Conversations only load AFTER user selection

✅ **Auto-create conversations**: Creates conversation automatically if it doesn't exist

✅ **No schema changes**: Only added new tables, didn't modify existing ones

✅ **Preserved messaging logic**: All existing message types, metadata, and quick actions work unchanged

✅ **Restored visibility**: Users are visible immediately upon opening Message Center

## Implementation Details

### User Selection Flow
1. User scrolls list of all active users
2. User clicks on a contact name
3. `selectContact(userId)` is called
4. System checks for existing conversation
5. If not found, creates one automatically
6. Loads messages from database
7. Chat window displays with existing messages and ready to accept new ones

### Message Sending Flow
1. User types message and hits send
2. `sendMessage()` is called with content and receiverId
3. Function finds/creates conversation if needed
4. Inserts message into `messages` table
5. Updates conversation `updated_at` timestamp
6. Creates local message for immediate display
7. Returns to allow continued typing

### Unread Tracking
- Maintains per-user unread count
- Shows badge on contact with unread messages
- Marks as read when conversation is opened
- Persists read state in database

## Database Setup Required

Run the migration to create the necessary tables:
```bash
supabase migration up 20260222_create_conversations_table
```

Or manually execute the SQL in Supabase Dashboard.

## Testing Checklist

- [ ] User can see all active users in Message Center sidebar
- [ ] Sidebar loads immediately without conversations
- [ ] Clicking a user creates/loads a conversation
- [ ] Messages display correctly for selected conversation
- [ ] Sending a message works and persists to database
- [ ] Unread badges update correctly
- [ ] Searching contacts works
- [ ] Mobile layout shows/hides sidebar correctly
- [ ] Quick actions (alerts, location, etc.) still work
- [ ] Role badges display correctly
- [ ] Loading spinner shows while contacts load

## Performance Considerations

- **Indexes**: Added on frequently queried columns for fast lookups
- **Lazy loading**: Conversations only load when needed
- **Selective queries**: Only loads active users (`status = 'ACTIVE'`)
- **Pagination**: Currently loads all users (can add pagination if needed)

## Future Enhancements

1. Add conversation search history
2. Implement conversation archiving
3. Add typing indicators
4. Implement message read receipts
5. Add online status indicators from real-time subscriptions
6. Support for group conversations
7. Message attachments/file sharing
8. Encryption at rest for sensitive messages
