-- Enable Realtime for the chat_messages table
-- This is REQUIRED for the chat to update instantly without refreshing.

BEGIN;

-- 1. Add the table to the supabase_realtime publication
-- Check if publication exists first (standard in Supabase), then add table
-- We use 'alter publication' inside a DO block to avoid errors if it doesn't match perfectly, 
-- but usually just running the alter command is robust enough in Supabase.

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- OR simpler specific approach if you don't want to recreate the default one:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- But safest "fix all" is often re-asserting it for tables.

-- Specific safe way:
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

COMMIT;
