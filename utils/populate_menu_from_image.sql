-- Limpiar datos existentes (opcional, comentar si se quieren conservar)
-- TRUNCATE products, categories RESTART IDENTITY CASCADE;

-- Insertar Categorías
INSERT INTO categories (name, slug) VALUES 
('Pizzas Clásicas', 'pizzas-clasicas'),
('Pizzas Especiales', 'pizzas-especiales')
ON CONFLICT DO NOTHING;

-- Definir URL del logo por defecto
WITH default_image AS (
    SELECT '/casalena-logo.jpg' as url
),
categories_ids AS (
    SELECT 
        (SELECT id FROM categories WHERE name = 'Pizzas Clásicas' LIMIT 1) as clasica_id,
        (SELECT id FROM categories WHERE name = 'Pizzas Especiales' LIMIT 1) as especial_id
)

INSERT INTO products (name, description, price, category_id, imagen_url, available)
SELECT * FROM (
    -- PIZZAS CLÁSICAS
    -- Pepperoni
    SELECT 'Pepperoni (Chica)', 'Pepperoni, salsa de tomate casera y mezcla de quesos', 200, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Pepperoni (Grande)', 'Pepperoni, salsa de tomate casera y mezcla de quesos', 225, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Pepperoni (Familiar)', 'Pepperoni, salsa de tomate casera y mezcla de quesos', 275, clasica_id, url, true FROM default_image, categories_ids
    
    -- Hawaiiana
    UNION ALL SELECT 'Hawaiiana (Chica)', 'Jamón, piña, salsa de tomate casera y mezcla de quesos', 200, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Hawaiiana (Grande)', 'Jamón, piña, salsa de tomate casera y mezcla de quesos', 225, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Hawaiiana (Familiar)', 'Jamón, piña, salsa de tomate casera y mezcla de quesos', 275, clasica_id, url, true FROM default_image, categories_ids

    -- Vegetariana
    UNION ALL SELECT 'Vegetariana (Chica)', 'Champiñones, aceitunas negras, pimiento verde, cebolla, salsa de tomate casera y mezcla de quesos', 200, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Vegetariana (Grande)', 'Champiñones, aceitunas negras, pimiento verde, cebolla, salsa de tomate casera y mezcla de quesos', 225, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Vegetariana (Familiar)', 'Champiñones, aceitunas negras, pimiento verde, cebolla, salsa de tomate casera y mezcla de quesos', 275, clasica_id, url, true FROM default_image, categories_ids

    -- Cuatro Quesos
    UNION ALL SELECT 'Cuatro Quesos (Chica)', 'Mozzarella, gouda, monterrey jack, queso de cabra, salsa de tomate casera y mezcla de quesos', 200, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Cuatro Quesos (Grande)', 'Mozzarella, gouda, monterrey jack, queso de cabra, salsa de tomate casera y mezcla de quesos', 225, clasica_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Cuatro Quesos (Familiar)', 'Mozzarella, gouda, monterrey jack, queso de cabra, salsa de tomate casera y mezcla de quesos', 275, clasica_id, url, true FROM default_image, categories_ids


    -- PIZZAS ESPECIALES
    -- Casaleña
    UNION ALL SELECT 'Casaleña (Chica)', 'Carne molida, tocino, pimiento, cebolla, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Casaleña (Grande)', 'Carne molida, tocino, pimiento, cebolla, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Casaleña (Familiar)', 'Carne molida, tocino, pimiento, cebolla, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids

    -- Mexicana
    UNION ALL SELECT 'Mexicana (Chica)', 'Chorizo, jamón, pimienta, jalapeño en nachos, cebolla, pimiento, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Mexicana (Grande)', 'Chorizo, jamón, pimienta, jalapeño en nachos, cebolla, pimiento, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Mexicana (Familiar)', 'Chorizo, jamón, pimienta, jalapeño en nachos, cebolla, pimiento, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids

    -- Caprichosa
    UNION ALL SELECT 'Caprichosa (Chica)', 'Tocino, jamón, piña, cebolla, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Caprichosa (Grande)', 'Tocino, jamón, piña, cebolla, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Caprichosa (Familiar)', 'Tocino, jamón, piña, cebolla, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids

    -- Carnivora
    UNION ALL SELECT 'Carnívora (Chica)', 'Chorizo, carne molida, jamón, pepperoni, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Carnívora (Grande)', 'Chorizo, carne molida, jamón, pepperoni, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Carnívora (Familiar)', 'Chorizo, carne molida, jamón, pepperoni, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids

    -- Diabla
    UNION ALL SELECT 'Diabla (Chica)', 'Pepperoni, chorizo, jalapeño en nachos, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Diabla (Grande)', 'Pepperoni, chorizo, jalapeño en nachos, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Diabla (Familiar)', 'Pepperoni, chorizo, jalapeño en nachos, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids

    -- Italiana
    UNION ALL SELECT 'Italiana (Chica)', 'Pepperoni, aceitunas negras, champiñones, salsa de tomate casera y mezcla de quesos', 210, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Italiana (Grande)', 'Pepperoni, aceitunas negras, champiñones, salsa de tomate casera y mezcla de quesos', 245, especial_id, url, true FROM default_image, categories_ids
    UNION ALL SELECT 'Italiana (Familiar)', 'Pepperoni, aceitunas negras, champiñones, salsa de tomate casera y mezcla de quesos', 295, especial_id, url, true FROM default_image, categories_ids
) as new_products;
