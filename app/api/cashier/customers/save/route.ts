import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
    phone: z.string().min(1),
    full_name: z.string().min(1),
    address: z.string().optional().default('')
});

export async function POST(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Datos de cliente inválidos" }, { status: 400 });
        }

        const { phone, full_name, address } = parsed.data;

        const { data, error } = await supabaseAdmin
            .from('customers')
            .upsert({
                phone: phone.trim(),
                full_name: full_name,
                address: address
            }, { onConflict: 'phone' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, customer: data });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Save Customer Error');
    }
}

