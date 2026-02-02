-- Separate statements to avoid syntax errors if executed partially or in strictly parsed environments
ALTER TABLE settings ADD COLUMN IF NOT EXISTS automatic_schedule BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS open_time TIME DEFAULT '14:00:00';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS close_time TIME DEFAULT '22:30:00';
