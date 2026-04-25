
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

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const term = searchParams.get('term');

        if (!term || term.length < 2) {
            return NextResponse.json({ customers: [] });
        }

        console.log(`🔍 [API-CustomerSearch] Buscando: "${term}"`);

        // 1. Buscar en tabla 'customers' (clientes ad-hoc)
        const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(50);

        if (customersError) throw customersError;

        // 2. Buscar en tabla 'profiles' (usuarios registrados de la app)
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number, address')
            .or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`)
            .limit(50);

        // 3. Normalizar resultados
        const normalizedProfiles = (profilesData || []).map(p => ({
            id: p.id,
            full_name: p.full_name || 'Cliente App',
            phone: p.phone_number || '',
            address: p.address || '',
            is_app_user: true
        }));

        const normalizedCustomers = (customersData || []).map(c => ({
            ...c,
            is_app_user: false
        }));

        // 4. Combinar y eliminar duplicados por teléfono
        const combined = [...normalizedCustomers, ...normalizedProfiles];
        const uniqueByPhone = Array.from(new Map(combined.map(item => [item.phone, item])).values());

        console.log(`✅ [API-CustomerSearch] Encontrados ${uniqueByPhone.length} clientes.`);

        return NextResponse.json({
            customers: uniqueByPhone.slice(0, 20)
        });

    } catch (error: any) {
        console.error('❌ [API-CustomerSearch] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
