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
    
    const startDate = '2026-05-01';
    const endDate = '2026-06-01';
    const tz = '-05:00';

    // 1. With offset
    const gteStr = `${startDate}T00:00:00${tz}`;
    const lteStr = `${endDate}T23:59:59${tz}`;
    console.log(`Query range (Local -05:00): ${gteStr} to ${lteStr}`);

    const { data: ordersWithOffset, error: err1 } = await supabase
        .from('orders')
        .select('id, created_at, total_amount')
        .gte('created_at', gteStr)
        .lte('created_at', lteStr)
        .order('created_at', { ascending: false });

    // 2. Without offset (UTC)
    const gteUTC = `${startDate}T00:00:00`;
    const lteUTC = `${endDate}T23:59:59`;
    console.log(`Query range (UTC): ${gteUTC} to ${lteUTC}`);

    const { data: ordersUTC, error: err2 } = await supabase
        .from('orders')
        .select('id, created_at, total_amount')
        .gte('created_at', gteUTC)
        .lte('created_at', lteUTC)
        .order('created_at', { ascending: false });

    console.log('\n--- RESULTS ---');
    console.log(`Total orders WITH OFFSET (-05:00): ${ordersWithOffset?.length || 0}`);
    console.log(`Total orders WITHOUT OFFSET (UTC): ${ordersUTC?.length || 0}`);

    // Let's check boundary orders.
    // Let's find orders between 2026-04-30 and 2026-05-02
    const { data: earlyMayOrders } = await supabase
        .from('orders')
        .select('id, created_at, total_amount')
        .gte('created_at', '2026-04-30T00:00:00Z')
        .lte('created_at', '2026-05-02T23:59:59Z')
        .order('created_at', { ascending: true });

    console.log('\n--- ORDERS AROUND START DATE (2026-04-30 to 2026-05-02 UTC) ---');
    earlyMayOrders?.forEach(o => {
        const localTime = new Date(o.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
        console.log(`ID: ${o.id} | UTC: ${o.created_at} | Local (MX): ${localTime} | Amount: ${o.total_amount}`);
    });

    // Let's find orders between 2026-06-01 and 2026-06-03
    const { data: lateMayOrders } = await supabase
        .from('orders')
        .select('id, created_at, total_amount')
        .gte('created_at', '2026-05-31T00:00:00Z')
        .lte('created_at', '2026-06-02T23:59:59Z')
        .order('created_at', { ascending: true });

    console.log('\n--- ORDERS AROUND END DATE (2026-05-31 to 2026-06-02 UTC) ---');
    lateMayOrders?.forEach(o => {
        const localTime = new Date(o.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
        console.log(`ID: ${o.id} | UTC: ${o.created_at} | Local (MX): ${localTime} | Amount: ${o.total_amount}`);
    });

    process.exit(0);
}

checkOrders();
