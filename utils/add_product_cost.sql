-- Script para agregar columna de costo a los productos
-- Ejecuta esto en el SQL Editor de Supabase

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) DEFAULT 0.00;
