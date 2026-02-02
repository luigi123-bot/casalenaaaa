-- FIX CHAT REALTIME & PERMISSIONS
-- Since 'supabase_realtime' is already 'FOR ALL TABLES', we don't need to add the table.
-- The issue is likely RLS (Row Level Security) hiding the new messages from the listeners.

BEGIN;

-- 1. Ensure Table Permissions are robust
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 2. RESET POLICIES (Drop old ones to avoid conflicts)
DROP POLICY IF EXISTS "Users can see their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can translate their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins View All" ON chat_messages;
DROP POLICY IF EXISTS "Admins Reply" ON chat_messages;
DROP POLICY IF EXISTS "Admins Update" ON chat_messages;

-- 3. RE-CREATE POLICIES

-- A. Client Policies
-- Client can see messages where they are the owner (user_id matches)
CREATE POLICY "Client Select Own" ON chat_messages 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- Client can insert messages where they are the owner
CREATE POLICY "Client Insert Own" ON chat_messages 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- B. Admin Policies
-- Admins/Cajeros can do EVERYTHING on chat_messages
CREATE POLICY "Admin All Access" ON chat_messages 
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('administrador', 'cajero', 'cocina') -- Added cocina just in case
  )
);

-- 4. Enable Full Replica Identity
-- This ensures Realtime sends all columns, preventing issues with filtering
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

COMMIT;
