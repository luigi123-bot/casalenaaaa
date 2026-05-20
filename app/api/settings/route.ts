import { NextRequest, NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const settingsUpdateSchema = z.object({
    restaurantName: z.string().min(1).max(255).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(50).optional(),
    currency: z.string().max(10).optional(),
    isOpen: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    autoPrintReceipts: z.boolean().optional(),
    automaticSchedule: z.boolean().optional(),
    openTime: z.string().max(20).optional(),
    closeTime: z.string().max(20).optional(),
    logoUrl: z.string().max(2048).optional(),
    whatsapp: z.string().max(50).optional(),
    instagram: z.string().max(100).optional(),
    facebook: z.string().max(100).optional(),
    taxPercentage: z.coerce.number().min(0).max(100).optional(),
    autoCashierSchedule: z.boolean().optional(),
    cashierOpenTime: z.string().max(20).optional(),
    cashierCloseTime: z.string().max(20).optional()
});

const DEFAULT_SETTINGS = {
    restaurant_name: 'CASALEÑA',
    address: 'BOULEVARD JUAN N ALVAREZ, COL. SENTIMIENTOS DE LA NACIÓN, OMETEPEC GUERRERO CP 41706',
    phone: '741-101-1595',
    currency: 'MXN',
    is_open: true,
    email_notifications: true,
    auto_print_receipts: false,
    automatic_schedule: true,
    open_time: '13:00',
    close_time: '21:30',
    logo_url: '/icon.png',
    whatsapp: '741-107-5056',
    instagram: 'casalenapizza',
    facebook: 'casalenapizza',
    tax_percentage: 16,
    auto_cashier_schedule: false,
    cashier_open_time: '13:00',
    cashier_close_time: '21:30'
};

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(DEFAULT_SETTINGS);
            }
            throw error;
        }

        return NextResponse.json(data);
    } catch (error) {
        return handleServerError(error, 'GET Settings API Error');
    }
}

export async function POST(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = settingsUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros de configuración inválidos' }, { status: 400 });
        }

        const updates: Record<string, any> = { id: 1 };
        const b = parsed.data;

        if (b.restaurantName !== undefined) updates.restaurant_name = b.restaurantName;
        if (b.address !== undefined) updates.address = b.address;
        if (b.phone !== undefined) updates.phone = b.phone;
        if (b.currency !== undefined) updates.currency = b.currency;
        if (b.isOpen !== undefined) updates.is_open = b.isOpen;
        if (b.emailNotifications !== undefined) updates.email_notifications = b.emailNotifications;
        if (b.autoPrintReceipts !== undefined) updates.auto_print_receipts = b.autoPrintReceipts;
        if (b.automaticSchedule !== undefined) updates.automatic_schedule = b.automaticSchedule;
        if (b.openTime !== undefined) updates.open_time = b.openTime;
        if (b.closeTime !== undefined) updates.close_time = b.closeTime;
        if (b.logoUrl !== undefined) updates.logo_url = b.logoUrl;
        if (b.whatsapp !== undefined) updates.whatsapp = b.whatsapp;
        if (b.instagram !== undefined) updates.instagram = b.instagram;
        if (b.facebook !== undefined) updates.facebook = b.facebook;
        if (b.taxPercentage !== undefined) updates.tax_percentage = b.taxPercentage;
        if (b.autoCashierSchedule !== undefined) updates.auto_cashier_schedule = b.autoCashierSchedule;
        if (b.cashierOpenTime !== undefined) updates.cashier_open_time = b.cashierOpenTime;
        if (b.cashierCloseTime !== undefined) updates.cashier_close_time = b.cashierCloseTime;

        const { data, error } = await supabaseAdmin
            .from('settings')
            .upsert(updates)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return handleServerError(error, 'POST Settings API Error');
    }
}

