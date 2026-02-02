-- ============================================
-- COMPLETE FIX: Convert role column to TEXT
-- ============================================
-- This handles the RLS policy dependency issue

-- Step 1: Drop the RLS policy that depends on profiles.role
DROP POLICY IF EXISTS "Enable write access for admins only" ON roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON roles;

-- Step 2: Drop any default value
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

-- Step 2: Convert column type to TEXT
-- (This works even if there's an enum - it converts existing values)
ALTER TABLE profiles ALTER COLUMN role TYPE text;

-- Step 4: Set new default
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'cliente';

-- Step 5: Recreate the RLS policies (now they'll work with TEXT)
CREATE POLICY "Enable read access for all users" ON roles
    FOR SELECT USING (true);

CREATE POLICY "Enable write access for admins only" ON roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'administrador'
        )
    );

-- Step 6: Verify the change worked
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';
