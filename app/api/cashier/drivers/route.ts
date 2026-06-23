import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const driverId = searchParams.get('id');

        if (driverId) {
            const { data, error } = await supabaseAdmin
                .from('delivery_drivers')
                .select('*')
                .eq('id', driverId)
                .maybeSingle();

            if (error) throw error;
            return NextResponse.json(data);
        } else {
            const { data, error } = await supabaseAdmin
                .from('delivery_drivers')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            return NextResponse.json(data || []);
        }
    } catch (error: any) {
        return handleServerError(error, 'Get Cashier Drivers API Error');
    }
}
