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

    // Query information_schema.columns for the orders table
    const { data, error } = await supabase
        .from('orders')
        .select('created_at')
        .limit(1);

    if (error) {
        console.error('Error querying orders:', error);
    } else {
        console.log('Sample order data:', data);
    }

    // Let's run a raw query through Postgres via RPC or direct SQL if possible, 
    // but we can query using Supabase client to see metadata or use a quick query to see how Postgres parses timezone offsets.
    // We can do this by executing a select of a timestamptz cast.
    const { data: tzTest, error: tzError } = await supabase
        .rpc('get_schema_info'); // Let's check if there is an RPC

    if (tzError) {
        console.log('RPC get_schema_info not available, let us do a direct test of the timestamp parsing.');
    } else {
        console.log('Schema info:', tzTest);
    }

    // Check what happens if we query with and without offset on a known order ID
    // Order ID 1111 has created_at '2026-06-08T03:43:43.872+00:00'
    // Let's query it with a boundary condition that depends on timezone offset
    // 2026-06-08T03:43:43.872Z is:
    // - Before 2026-06-08T00:00:00-05:00 (which is 2026-06-08T05:00:00Z)
    // - After 2026-06-07T00:00:00-05:00 (which is 2026-06-07T05:00:00Z)
    
    const { data: testWithOffset } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('id', 1111)
        .gte('created_at', '2026-06-08T00:00:00-05:00'); // This should return EMPTY if offset is respected

    const { data: testWithoutOffset } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('id', 1111)
        .gte('created_at', '2026-06-08T00:00:00Z'); // This should return the order

    console.log(`\nQuerying order 1111 (created_at = '2026-06-08T03:43:43.872+00:00')`);
    console.log(`With gte '2026-06-08T00:00:00-05:00':`, testWithOffset);
    console.log(`With gte '2026-06-08T00:00:00Z':`, testWithoutOffset);

    process.exit(0);
}

checkSchema();
