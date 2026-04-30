import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { months } = await request.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Falta GEMINI_API_KEY en las variables de entorno" }, { status: 500 });
        }

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - (months || 3));

        // 1. Obtener datos consolidados (Lógica similar al consolidador)
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                created_at,
                total_amount,
                status,
                payment_method,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    product_name,
                    products (
                        name,
                        cost,
                        categories (
                            name
                        )
                    )
                )
            `)
            .gte('created_at', startDate.toISOString())
            .neq('status', 'cancelado')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const consolidatedData = orders?.flatMap(order => {
            const date = new Date(order.created_at);
            return (order.order_items as any[])?.map(item => ({
                t: order.created_at,
                p: item.product_name || item.products?.name,
                c: item.products?.categories?.name,
                q: item.quantity,
                rev: (item.unit_price || 0) * item.quantity,
                cost: (item.products?.cost || 0) * item.quantity
            }));
        }) || [];

        // 2. Preparar el modelo con fallback para asegurar compatibilidad
        let model;
        try {
            // Intentamos con el modelo más eficiente
            model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } catch (e) {
            // Si falla, usamos el modelo más compatible universalmente 
            model = genAI.getGenerativeModel({ model: "gemini-pro" });
        }

        const prompt = `
        Eres un experto consultor de negocios y analista de datos para el restaurante "Casaleña".
        A continuación te presento los datos de ventas y costos de los últimos ${months} meses.
        
        Datos (formato simplificado: t=tiempo, p=producto, c=categoría, q=cantidad, rev=ingreso, cost=costo):
        ${JSON.stringify(consolidatedData.slice(0, 500))} 
        
        Nota: Solo te envío una muestra representativa de los primeros 500 registros para análisis de tendencias.
        
        Tu tarea es:
        1. Identificar los 3 productos más rentables (mejor margen total).
        2. Identificar "productos trampa" (mucha venta pero bajo margen).
        3. Analizar tendencias por horario o día si es posible.
        4. Dar 3 recomendaciones accionables para aumentar la rentabilidad este mes.
        
        Responde en español, usando un tono profesional, ejecutivo y motivador. Usa formato Markdown.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ insight: text });

    } catch (error: any) {
        console.error('[AI ANALYSIS] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
