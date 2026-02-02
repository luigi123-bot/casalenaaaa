-- Create Categories Table
create table if not exists categories (
  id bigint primary key generated always as identity,
  name text not null,
  slug text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Products Table
create table if not exists products (
  id bigint primary key generated always as identity,
  name text not null,
  description text,
  price numeric(10,2) not null,
  imagen_url text,
  category_id bigint references categories(id),
  available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_spicy boolean default false,
  is_signature boolean default false
);

-- Enable RLS
alter table categories enable row level security;
alter table products enable row level security;

-- Create policies (Allow all for now for simplicity, or restricted)
create policy "Allow public read access" on categories for select using (true);
create policy "Allow authenticated insert" on categories for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on categories for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on categories for delete using (auth.role() = 'authenticated');

create policy "Allow public read access" on products for select using (true);
create policy "Allow authenticated insert" on products for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on products for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on products for delete using (auth.role() = 'authenticated');

-- Insert default categories
insert into categories (name, slug) values
('Pizzas', 'pizzas'),
('Bebidas', 'bebidas'),
('Postres', 'postres'),
('Combos', 'combos')
on conflict (slug) do nothing;

-- Insert sample products
insert into products (name, description, price, category_id, imagen_url, available, is_signature) values
('Margarita', 'Salsa de tomate casera, mozzarella fresca y albahaca.', 12.00, 1, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=500&q=80', true, true),
('Pepperoni', 'Doble porción de pepperoni y queso mozzarella.', 14.50, 1, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80', true, false),
('Coca-Cola', 'Lata 355ml', 2.50, 2, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=500&q=80', true, false),
('Tiramisú', 'Clásico postre italiano con café y mascarpone.', 6.00, 3, 'https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=500&q=80', true, false);
