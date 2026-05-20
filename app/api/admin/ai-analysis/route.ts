import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const inputSchema = z.object({
    months: z.number().int().min(1).max(12).optional().default(3)
});

export async function POST(request: Request) {
    try {
        // 1. Authenticate & Authorize (Admin only)
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Servicio de análisis no configurado" }, { status: 500 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros de meses inválidos" }, { status: 400 });
        }

        const { months } = parsed.data;

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        // Consolidated data retrieval
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
            return (order.order_items as any[])?.map(item => ({
                t: order.created_at,
                p: item.product_name || item.products?.name,
                c: item.products?.categories?.name,
                q: item.quantity,
                rev: (item.unit_price || 0) * item.quantity,
                cost: (item.products?.cost || 0) * item.quantity
            }));
        }) || [];

        // Prepare model
        let model;
        try {
            model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } catch (e) {
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
        return handleServerError(error, 'AI Analysis API Error');
    }
}

