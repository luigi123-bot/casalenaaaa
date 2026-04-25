import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkOrders() {
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
    
    console.log('--- 10 ÚLTIMAS ÓRDENES ---');
    const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, order_type, status, customer_name, total_amount')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching orders:', error);
    } else {
        console.table(data);
    }

    process.exit(0);
}

checkOrders();
