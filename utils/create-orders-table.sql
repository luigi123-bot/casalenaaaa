-- Create Order Status Enum
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN 
        create type order_status as enum ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'); 
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN 
        create type order_type as enum ('dine-in', 'takeout', 'delivery'); 
    END IF;
END $$;

-- Create Orders Table
create table if not exists orders (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id),
  customer_name text, -- For quick display without join or for guest orders
  status order_status default 'pending',
  order_type order_type default 'dine-in',
  total_amount numeric(10,2) not null default 0,
  table_number text, -- Optional for dine-in
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Order Items Table
create table if not exists order_items (
  id bigint primary key generated always as identity,
  order_id bigint references orders(id) on delete cascade,
  product_id bigint references products(id),
  product_name text not null, -- Snapshot of name in case product changes
  quantity integer not null default 1,
  unit_price numeric(10,2) not null, -- Snapshot of price
  total_price numeric(10,2) not null,
  selected_size text,
  extras jsonb, -- Store selected extras/customizations
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table orders enable row level security;
alter table order_items enable row level security;

-- Policies for Orders
create policy "Users can view their own orders" on orders
  for select using (auth.uid() = user_id);

create policy "Users can create their own orders" on orders
  for insert with check (auth.uid() = user_id);

create policy "Staff can view all orders" on orders
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrador', 'cajero', 'cocina')
    )
  );

create policy "Staff can update orders" on orders
  for update using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrador', 'cajero', 'cocina')
    )
  );

-- Policies for Order Items
create policy "Users can view their own order items" on order_items
  for select using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Users can create their own order items" on order_items
  for insert with check (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Staff can view all order items" on order_items
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrador', 'cajero', 'cocina')
    )
  );
