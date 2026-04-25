
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

async function checkRLS() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'orders' });
    
    if (error) {
        // Si el RPC no existe, probar con una query directa a pg_policies
        const { data: policies, error: pgError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'orders');
        
        if (pgError) {
            console.log('ℹ️ No se pudieron leer las políticas directamente. Probando acceso anónimo...');
            const { data: test, error: testErr } = await supabase.from('orders').select('id').limit(1);
            console.log('Test select orders (anon):', testErr ? '❌ Falló: ' + testErr.message : '✅ Exitoso');
        } else {
            console.log('📋 Políticas detectadas:', policies);
        }
    } else {
        console.log('📋 Políticas (RPC):', data);
    }
}

checkRLS();
