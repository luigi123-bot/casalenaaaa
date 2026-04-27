
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { order, items } = body;

        console.log(`🚀 [API-SaveOrder] Iniciando proceso para: ${order.customer_name || 'Sin nombre'} (${order.phone_number || 'Sin Tel'})`);
        console.log(`📦 [API-SaveOrder] Payload completo:`, JSON.stringify(body, null, 2));

        // 1. GESTIÓN AUTOMÁTICA DE CLIENTE (Upsert)
        // Solo si es delivery o takeout y tiene teléfono
        if ((order.order_type === 'delivery' || order.order_type === 'takeout') && order.phone_number) {
            try {
                const phoneClean = order.phone_number.replace(/\D/g, '');
                if (phoneClean.length >= 7) {
                    console.log(`👤 [API-SaveOrder] Upsert de cliente: ${phoneClean} (${order.customer_name})`);
                    const { error: upsertError } = await supabase
                        .from('customers')
                        .upsert({
                            phone: phoneClean,
                            full_name: order.customer_name || 'Cliente Nuevo',
                            address: order.delivery_address || '',
                            last_order_at: new Date().toISOString()
                        }, { onConflict: 'phone' });
                    
                    if (upsertError) {
                        console.error('❌ [API-SaveOrder] Error en upsert de cliente:', upsertError);
                    } else {
                        console.log('✅ [API-SaveOrder] Cliente sincronizado correctamente.');
                    }
                }
            } catch (err) {
                console.warn('⚠️ [API-SaveOrder] Error no crítico guardando cliente:', err);
                // No detenemos la orden por un error en el guardado de cliente
            }
        }

        // 2. GUARDAR LA ORDEN
        let orderId = order.id;
        let createdOrder = null;

        if (orderId) {
            // Actualizar orden existente
            const { data, error } = await supabase
                .from('orders')
                .update({
                    ...order,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;

            // Limpiar items anteriores para re-insertar
            await supabase.from('order_items').delete().eq('order_id', orderId);
        } else {
            // Nueva orden
            // Generar número de ticket diario buscando el primer hueco disponible
            const today = new Date().toLocaleDateString('en-CA');
            const { data: ticketData } = await supabase
                .from('orders')
                .select('ticket_number')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59')
                .order('ticket_number', { ascending: true });

            let dailySequence = 1;
            if (ticketData && ticketData.length > 0) {
                const usedNumbers = new Set(ticketData.map(o => Number(o.ticket_number)));
                while (usedNumbers.has(dailySequence)) {
                    dailySequence++;
                }
            }

            const { data, error } = await supabase
                .from('orders')
                .insert({
                    ...order,
                    ticket_number: dailySequence,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;
            orderId = data.id;
        }

        // 3. GUARDAR ITEMS
        const itemsWithOrderId = items.map((it: any) => ({
            ...it,
            order_id: orderId
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsWithOrderId);

        if (itemsError) throw itemsError;

        console.log(`✅ [API-SaveOrder] Orden ${orderId} guardada exitosamente.`);

        return NextResponse.json({
            success: true,
            order: createdOrder
        });

    } catch (error: any) {
        console.error('❌ [API-SaveOrder] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
