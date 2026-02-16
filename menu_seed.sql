-- ============================================
-- LIMPIEZA TOTAL DEL MENÚ
-- ============================================
DELETE FROM order_items;
DELETE FROM products;
DELETE FROM categories;

-- ============================================
-- 1. CREACIÓN DE CATEGORÍAS
-- ============================================
INSERT INTO categories (name, slug) VALUES 
('Hamburguesas', 'hamburguesas'),
('Pizza & Friends - Combos', 'pizza-friends-combos'),
('Entradas y snacks', 'entradas-y-snacks'),
('Pizzas tradicionales', 'pizzas-tradicionales'),
('Especialidades Casaleña', 'especialidades-casalena'),
('Gourmet', 'gourmet'),
('Orilla de queso (extra)', 'orilla-queso-extra'),
('Postres', 'postres'),
('Bebidas', 'bebidas')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- ============================================
-- 2. INSERCIÓN DE PRODUCTOS
-- ============================================
DO $$
DECLARE
    cat_hamburguesas INT;
    cat_combos INT;
    cat_entradas INT;
    cat_tradicionales INT;
    cat_especiales INT;
    cat_gourmet INT;
    cat_orilla INT;
    cat_postres INT;
    cat_bebidas INT;
BEGIN
    SELECT id INTO cat_hamburguesas FROM categories WHERE slug = 'hamburguesas';
    SELECT id INTO cat_combos FROM categories WHERE slug = 'pizza-friends-combos';
    SELECT id INTO cat_entradas FROM categories WHERE slug = 'entradas-y-snacks';
    SELECT id INTO cat_tradicionales FROM categories WHERE slug = 'pizzas-tradicionales';
    SELECT id INTO cat_especiales FROM categories WHERE slug = 'especialidades-casalena';
    SELECT id INTO cat_gourmet FROM categories WHERE slug = 'gourmet';
    SELECT id INTO cat_orilla FROM categories WHERE slug = 'orilla-queso-extra';
    SELECT id INTO cat_postres FROM categories WHERE slug = 'postres';
    SELECT id INTO cat_bebidas FROM categories WHERE slug = 'bebidas';

    -- HAMBURGUESAS
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Classic Burger', 'Carne de res jugosa, queso fundido, jitomate, lechuga y aderezo Casaleña.', 95.00, cat_hamburguesas, '/icon.png', true),
    ('Bacon & Cheese Burger', 'Carne de res, tocino, queso fundido y aderezo.', 120.00, cat_hamburguesas, '/icon.png', true),
    ('Crunchy Boneless Burger', 'Pollo estilo mega boneless con salsa a elegir.', 115.00, cat_hamburguesas, '/icon.png', true);

    -- PIZZA & FRIENDS - COMBOS
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Combo Mega Familiar', '1 pizza tradicional familiar + 1 alitas 6 pz + 1 refresco 2 L', 420.00, cat_combos, '/icon.png', true),
    ('Combo Amigos', '1 pizza especialidad grande + 1 papas fritas + 1 refresco 2 L', 335.00, cat_combos, '/icon.png', true),
    ('Combo Individual', '1 classic burger + 1 papas fritas + 1 refresco lata', 145.00, cat_combos, '/icon.png', true);

    -- ENTRADAS Y SNACKS
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Pizza de ajo y hierbas', 'Mantequilla de ajo y finas hierbas.', 120.00, cat_entradas, '/icon.png', true),
    ('Papas fritas clásicas', 'Sazonadas.', 60.00, cat_entradas, '/icon.png', true),
    ('Papas con queso cheddar', 'Bañadas con queso cheddar.', 80.00, cat_entradas, '/icon.png', true),
    ('Cheesy sticks (5 pz)', 'Bastoncitos de queso.', 90.00, cat_entradas, '/icon.png', true),
    ('Alitas Casaleña (6 pz)', 'Bañadas en salsa favorita.', 130.00, cat_entradas, '/icon.png', true),
    ('Alitas Casaleña (12 pz)', 'Bañadas en salsa favorita.', 250.00, cat_entradas, '/icon.png', true),
    ('Boneless (7 pz)', 'Trocitos de pollo bañados.', 110.00, cat_entradas, '/icon.png', true),
    ('Boneless pack (14 pz)', 'Incluye 100gr de papas fritas.', 210.00, cat_entradas, '/icon.png', true);

    -- PIZZAS TRADICIONALES
    -- Formato: Sabor (Tamaño) para la lógica de la caja
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Pepperoni (Chica 12")', 'Clásica con pepperoni.', 200.00, cat_tradicionales, '/icon.png', true),
    ('Pepperoni (Grande 14")', 'Clásica con pepperoni.', 225.00, cat_tradicionales, '/icon.png', true),
    ('Pepperoni (Familiar 16")', 'Clásica con pepperoni.', 270.00, cat_tradicionales, '/icon.png', true),
    ('4 quesos (Chica 12")', 'Mezcla cremosa de quesos.', 200.00, cat_tradicionales, '/icon.png', true),
    ('4 quesos (Grande 14")', 'Mezcla cremosa de quesos.', 225.00, cat_tradicionales, '/icon.png', true),
    ('4 quesos (Familiar 16")', 'Mezcla cremosa de quesos.', 270.00, cat_tradicionales, '/icon.png', true),
    ('Vegetariana (Chica 12")', 'Cebolla, champiñones, pimiento y aceitunas.', 200.00, cat_tradicionales, '/icon.png', true),
    ('Vegetariana (Grande 14")', 'Cebolla, champiñones, pimiento y aceitunas.', 225.00, cat_tradicionales, '/icon.png', true),
    ('Vegetariana (Familiar 16")', 'Cebolla, champiñones, pimiento y aceitunas.', 270.00, cat_tradicionales, '/icon.png', true);

    -- ESPECIALIDADES CASALEÑA
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Hawaiana especial (Chica 12")', 'Jamón y piña.', 235.00, cat_especiales, '/icon.png', true),
    ('Hawaiana especial (Grande 14")', 'Jamón y piña.', 255.00, cat_especiales, '/icon.png', true),
    ('Hawaiana especial (Familiar 16")', 'Jamón y piña.', 295.00, cat_especiales, '/icon.png', true),
    ('Casaleña (Chica 12")', 'Carne de res, tocino, pimiento y cebolla.', 235.00, cat_especiales, '/icon.png', true),
    ('Casaleña (Grande 14")', 'Carne de res, tocino, pimiento y cebolla.', 255.00, cat_especiales, '/icon.png', true),
    ('Casaleña (Familiar 16")', 'Carne de res, tocino, pimiento y cebolla.', 295.00, cat_especiales, '/icon.png', true),
    ('Carnívora (Chica 12")', 'Chorizo, res, pepperoni y jamón.', 235.00, cat_especiales, '/icon.png', true),
    ('Carnívora (Grande 14")', 'Chorizo, res, pepperoni y jamón.', 255.00, cat_especiales, '/icon.png', true),
    ('Carnívora (Familiar 16")', 'Chorizo, res, pepperoni y jamón.', 295.00, cat_especiales, '/icon.png', true),
    ('Mexicana (Chica 12")', 'Chorizo, jamón y jalapeño.', 235.00, cat_especiales, '/icon.png', true),
    ('Mexicana (Grande 14")', 'Chorizo, jamón y jalapeño.', 255.00, cat_especiales, '/icon.png', true),
    ('Mexicana (Familiar 16")', 'Chorizo, jamón y jalapeño.', 295.00, cat_especiales, '/icon.png', true);

    -- GOURMET
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Pepperoni honey (Chica 12")', 'Pepperoni, miel y chile quebrado.', 260.00, cat_gourmet, '/icon.png', true),
    ('Pepperoni honey (Grande 14")', 'Pepperoni, miel y chile quebrado.', 290.00, cat_gourmet, '/icon.png', true),
    ('Pepperoni honey (Familiar 16")', 'Pepperoni, miel y chile quebrado.', 330.00, cat_gourmet, '/icon.png', true),
    ('Pera y cabra (Chica 12")', 'Base blanca, pera y queso de cabra.', 260.00, cat_gourmet, '/icon.png', true),
    ('Pera y cabra (Grande 14")', 'Base blanca, pera y queso de cabra.', 290.00, cat_gourmet, '/icon.png', true),
    ('Pera y cabra (Familiar 16")', 'Base blanca, pera y queso de cabra.', 330.00, cat_gourmet, '/icon.png', true),
    ('Pastor y piña (Chica 12")', 'Carne al pastor y piña.', 260.00, cat_gourmet, '/icon.png', true),
    ('Pastor y piña (Grande 14")', 'Carne al pastor y piña.', 290.00, cat_gourmet, '/icon.png', true),
    ('Pastor y piña (Familiar 16")', 'Carne al pastor y piña.', 330.00, cat_gourmet, '/icon.png', true);

    -- ORILLA DE QUESO (EXTRA)
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Orilla de queso (Chica 12")', 'Agrega orilla de queso extra.', 65.00, cat_orilla, '/icon.png', true),
    ('Orilla de queso (Grande 14")', 'Agrega orilla de queso extra.', 75.00, cat_orilla, '/icon.png', true),
    ('Orilla de queso (Familiar 16")', 'Agrega orilla de queso extra.', 85.00, cat_orilla, '/icon.png', true);

    -- POSTRES
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Churro bites', 'Porción de churritos.', 80.00, cat_postres, '/icon.png', true),
    ('Dulce capricho', 'Base con Nutella y fruta.', 140.00, cat_postres, '/icon.png', true);

    -- BEBIDAS
    INSERT INTO products (name, description, price, category_id, imagen_url, available) VALUES
    ('Jarra de clericot', 'Especialidad de la casa.', 200.00, cat_bebidas, '/icon.png', true),
    ('Jarra de limonada mineral', 'Fresa y cítricos.', 125.00, cat_bebidas, '/icon.png', true),
    ('Piña colada', 'Refrescante.', 50.00, cat_bebidas, '/icon.png', true),
    ('Limonada mineral', 'Vaso 400ml.', 45.00, cat_bebidas, '/icon.png', true),
    ('Soda italiana', 'Sabor a elegir.', 75.00, cat_bebidas, '/icon.png', true),
    ('Copa de clericot', 'Individual.', 60.00, cat_bebidas, '/icon.png', true),
    ('Malteada de chocolate', 'Cremosa.', 60.00, cat_bebidas, '/icon.png', true),
    ('Malteada de fresa', 'Cremosa.', 60.00, cat_bebidas, '/icon.png', true),
    ('Café capuccino', 'Espresso y espuma.', 60.00, cat_bebidas, '/icon.png', true),
    ('Café americano', 'Café de grano.', 35.00, cat_bebidas, '/icon.png', true),
    ('Agua natural 500 ml', 'Básico.', 15.00, cat_bebidas, '/icon.png', true),
    ('Refrescos 600 ml', 'Línea Coca-Cola.', 30.00, cat_bebidas, '/icon.png', true),
    ('Coca-Cola de lata', '355 ml.', 30.00, cat_bebidas, '/icon.png', true),
    ('Jugo del Valle 600 ml', 'Varios sabores.', 25.00, cat_bebidas, '/icon.png', true),
    ('Refrescos de sabor 2 L', 'Ideal para compartir.', 50.00, cat_bebidas, '/icon.png', true),
    ('Coca-Cola 2 L', 'Ideal para compartir.', 60.00, cat_bebidas, '/icon.png', true);

END $$;
