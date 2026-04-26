import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const term = searchParams.get('term') || '';

        // ── Buscar en profiles (usuarios registrados con rol cliente) ─────────
        let profilesQuery = supabase
            .from('profiles')
            .select('id, full_name, phone_number, address, role')
            .eq('role', 'cliente')
            .order('full_name', { ascending: true })
            .limit(80);

        if (term.length >= 2) {
            profilesQuery = profilesQuery.or(
                `full_name.ilike.%${term}%,phone_number.ilike.%${term}%`
            );
        }

        // ── Buscar en customers (clientes ad-hoc del cajero) ──────────────────
        let customersQuery = supabase
            .from('customers')
            .select('id, full_name, phone, address')
            .order('full_name', { ascending: true })
            .limit(80);

        if (term.length >= 2) {
            customersQuery = customersQuery.or(
                `full_name.ilike.%${term}%,phone.ilike.%${term}%`
            );
        }

        const [profilesRes, customersRes] = await Promise.all([
            profilesQuery,
            customersQuery,
        ]);

        // ── Normalizar ────────────────────────────────────────────────────────
        const normalizedProfiles = (profilesRes.data || []).map(p => ({
            id: p.id,
            full_name: p.full_name || 'Cliente',
            phone: p.phone_number || '',
            address: p.address || '',
            is_app_user: true,
        }));

        const normalizedCustomers = (customersRes.data || []).map(c => ({
            id: c.id,
            full_name: c.full_name || 'Cliente',
            phone: c.phone || '',
            address: c.address || '',
            is_app_user: false,
        }));

        // Profiles primero, luego customers — deduplicar por teléfono
        const combined = [...normalizedProfiles, ...normalizedCustomers];
        const seen = new Set<string>();
        const unique = combined.filter(c => {
            const key = c.phone || `${c.full_name}-${c.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return NextResponse.json({ customers: unique.slice(0, 60) });

    } catch (error: any) {
        console.error('❌ [API-CustomerSearch] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
