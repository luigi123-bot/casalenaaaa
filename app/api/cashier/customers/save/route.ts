import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, requireSupabaseAdminConfig, supabaseAdmin } from "@/utils/supabase/server";
import { upsertCustomerSafe } from "@/utils/cashier/customers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
    phone: z.string().min(1),
    full_name: z.string().min(1),
    address: z.string().optional().default(''),
});

export async function POST(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const configError = requireSupabaseAdminConfig();
        if (configError) return configError;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Datos de cliente inválidos" }, { status: 400 });
        }

        const { phone, full_name, address } = parsed.data;
        const { skipped, customer } = await upsertCustomerSafe(supabaseAdmin, {
            phone,
            fullName: full_name,
            address,
            minDigits: 1,
        });

        if (skipped) {
            return NextResponse.json({ error: "El teléfono debe contener al menos un dígito válido" }, { status: 400 });
        }

        return NextResponse.json({ success: true, customer });
    } catch (error: unknown) {
        return handleServerError(error, 'Cashier Save Customer Error');
    }
}
