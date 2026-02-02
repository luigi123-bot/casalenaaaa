-- Add color column to roles if it doesn't exist
ALTER TABLE roles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#9ca3af';

-- Update default roles with specific colors
UPDATE roles SET color = '#F27405' WHERE name = 'cliente';       -- Orange
UPDATE roles SET color = '#7e22ce' WHERE name = 'administrador'; -- Purple
UPDATE roles SET color = '#1d4ed8' WHERE name = 'cajero';        -- Blue
UPDATE roles SET color = '#15803d' WHERE name = 'cocina';        -- Green

-- Add Foreign Key constraint to profiles info 'role' column
-- This ensures that users can only be assigned valid roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE profiles 
        DROP CONSTRAINT IF EXISTS fk_profiles_role;

        ALTER TABLE profiles
        ADD CONSTRAINT fk_profiles_role
        FOREIGN KEY (role) 
        REFERENCES roles(name)
        ON UPDATE CASCADE;
    END IF;
END $$;
