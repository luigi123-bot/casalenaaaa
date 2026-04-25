import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkItems() {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            env[key] = value;
        }
    });

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('--- BUSCANDO PRODUCTO PARA PRUEBA ---');
    const { data: pData } = await supabase.from('products').select('id').limit(1).single();
    if (!pData) {
        console.error('No hay productos en la BD.');
        process.exit(1);
    }
    console.log('ID Producto:', pData.id);

    console.log('--- INSERTANDO ORDEN Y ITEMS ---');
    const { data: oData, error: oErr } = await supabase.from('orders').insert({ order_type: 'takeout', status: 'pendiente', total_amount: 10 }).select();
    if (oErr) {
        console.error('Error Order:', oErr);
        process.exit(1);
    }
    const orderId = oData[0].id;

    const { error: iErr } = await supabase.from('order_items').insert({
        order_id: orderId,
        product_id: pData.id,
        quantity: 1,
        unit_price: 10,
        total_price: 10,
        product_name: 'Test Product'
    });

    if (iErr) {
        console.error('Error Items:', iErr);
    } else {
        console.log('Orden y Items insertados con éxito.');
        // Cleanup
        await supabase.from('order_items').delete().eq('order_id', orderId);
        await supabase.from('orders').delete().eq('id', orderId);
    }

    process.exit(0);
}

checkItems();
