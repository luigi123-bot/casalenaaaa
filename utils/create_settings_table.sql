-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id BIGINT PRIMARY KEY DEFAULT 1,
    restaurant_name TEXT,
    address TEXT,
    phone TEXT,
    currency TEXT DEFAULT 'MXN',
    is_open BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    auto_print_receipts BOOLEAN DEFAULT false,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Turn on RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (so the shop can see if it's open)
CREATE POLICY "Allow public read access" ON settings FOR SELECT USING (true);

-- Allow write access only to authenticated users usually, or service role.
-- For simplicity in this admin panel using service role in API:
-- API uses service role, so it bypasses RLS. 

-- Insert default row if not exists
INSERT INTO settings (id, restaurant_name, address, phone)
VALUES (1, 'Casa Leña', '123 Main St, City', '555-0123')
ON CONFLICT (id) DO NOTHING;
