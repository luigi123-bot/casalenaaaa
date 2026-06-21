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
        const phoneClean = phone.replace(/\D/g, '');

        // 1. Check if the customer already exists by phone
        const { data: existingCustomer } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('phone', phoneClean)
            .maybeSingle();

        let resultData = null;

        if (existingCustomer) {
            // Compare names (case-insensitive, ignoring multiple spaces)
            const normExisting = (existingCustomer.full_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const normNew = full_name.trim().toLowerCase().replace(/\s+/g, ' ');

            // If name matches, or if existing name is placeholder/empty, update
            const nameMatches = normExisting === normNew || normExisting === 'sin nombre' || normExisting === '';

            if (nameMatches) {
                const { data: updatedData, error: updateError } = await supabaseAdmin
                    .from('customers')
                    .update({
                        full_name: full_name,
                        address: address,
                        last_order_at: new Date().toISOString()
                    })
                    .eq('id', existingCustomer.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                resultData = updatedData;
            } else {
                console.log(`⚠️ [SaveCustomer] Phone ${phoneClean} already belongs to '${existingCustomer.full_name}'. Skipping update to '${full_name}' to avoid overwrite.`);
                resultData = existingCustomer;
            }
        } else {
            // Does not exist: insert new customer
            const { data: insertedData, error: insertError } = await supabaseAdmin
                .from('customers')
                .insert({
                    phone: phoneClean,
                    full_name: full_name,
                    address: address,
                    last_order_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;
            resultData = insertedData;
        }

        return NextResponse.json({ success: true, customer: resultData });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Save Customer Error');
    }
}

