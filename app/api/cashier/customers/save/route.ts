import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { phone, full_name, address } = body;

        if (!phone) {
            return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
        }

        console.log(`📡 [API] Guardando cliente: ${phone} (${full_name})`);

        const { data, error } = await supabase
            .from('customers')
            .upsert({
                phone: phone.trim(),
                full_name: full_name,
                address: address
            }, { onConflict: 'phone' })
            .select()
            .single();

        if (error) {
            console.error('❌ [API] Error Supabase:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, customer: data });

    } catch (error: any) {
        console.error('❌ [API] Error crítico:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
