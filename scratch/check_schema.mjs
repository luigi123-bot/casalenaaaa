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
    
    console.log('--- ESTRUCTURA DE TABLA ORDERS ---');
    // We can't easily get schema via JS client without RPC, but we can try to insert a dummy order to see errors
    const { error } = await supabase
        .from('orders')
        .insert({
            order_type: 'test',
            status: 'test',
            total_amount: 0
        });

    if (error) {
        console.error('Error inserting test order (check schema constraints):', error);
    } else {
        console.log('Test order inserted successfully. No strict constraints hit.');
    }

    process.exit(0);
}

checkSchema();
