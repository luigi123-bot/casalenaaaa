import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkSchema() {
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
    
    console.log('--- INSERTANDO ORDEN DE PRUEBA VALIDA ---');
    const { data, error } = await supabase
        .from('orders')
        .insert({
            order_type: 'takeout',
            status: 'pendiente',
            total_amount: 10,
            payment_method: 'efectivo'
        })
        .select();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Orden insertada con éxito:', data[0].id);
        // Clean up
        await supabase.from('orders').delete().eq('id', data[0].id);
    }

    process.exit(0);
}

checkSchema();
