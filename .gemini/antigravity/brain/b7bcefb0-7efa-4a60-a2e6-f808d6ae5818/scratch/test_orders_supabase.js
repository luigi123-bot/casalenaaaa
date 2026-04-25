
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

async function testOrdersQuery() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Faltan variables de entorno Supabase');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = localToday.toISOString();

    console.log(`📅 Probando consulta desde: ${localToday.toLocaleString()} (${start})`);
    
    const validStatuses = ['entregado', 'completado', 'listo', 'finalizado', 'confirmado'];

    console.time('⏱️ Tiempo de ejecución');
    const { data, error, count } = await supabase
        .from('orders')
        .select('id, total_amount, payment_method, status, created_at, order_items(product_name, quantity)', { count: 'exact' })
        .gte('created_at', start)
        .in('status', validStatuses);
    console.timeEnd('⏱️ Tiempo de ejecución');

    if (error) {
        console.error('❌ Error en la consulta:', error);
    } else {
        console.log(`✅ Consulta exitosa!`);
        console.log(`📦 Total de pedidos encontrados hoy: ${data.length} (Count exacto: ${count})`);
        
        if (data.length > 0) {
            console.log('📝 Primeros 3 pedidos:');
            console.table(data.slice(0, 3));
            
            const total = data.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            console.log(`💰 Suma total de ventas hoy: $${total.toFixed(2)}`);
        } else {
            console.log('ℹ️ No hay pedidos que coincidan con los criterios hoy.');
            
            // Probar sin filtro de status para ver si hay algo
            const { data: allToday } = await supabase
                .from('orders')
                .select('id, status, created_at')
                .gte('created_at', start);
            
            console.log(`🔍 Total pedidos hoy (cualquier status): ${allToday?.length || 0}`);
            if (allToday && allToday.length > 0) {
                console.log('📋 Statuses encontrados hoy:', [...new Set(allToday.map(o => o.status))]);
            }
        }
    }
}

testOrdersQuery();
