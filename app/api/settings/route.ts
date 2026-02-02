import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET() {
    try {
        console.log('Fetching settings with schedule...');
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('No settings found, returning defaults');
                return NextResponse.json({
                    restaurant_name: 'Casa Leña',
                    address: '123 Main St',
                    phone: '555-0123',
                    currency: 'MXN',
                    is_open: true,
                    email_notifications: true,
                    auto_print_receipts: false,
                    automatic_schedule: false,
                    open_time: '14:00',
                    close_time: '22:30'
                });
            }
            console.error('Error fetching settings:', error);
            // Return mocks if DB issues
            return NextResponse.json({
                restaurant_name: 'Casa Leña',
                address: '123 Main St',
                phone: '555-0123',
                currency: 'MXN',
                is_open: true,
                email_notifications: true,
                auto_print_receipts: false,
                automatic_schedule: false,
                open_time: '14:00',
                close_time: '22:30'
            });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('Updating settings:', body);

        const updates = {
            id: 1,
            restaurant_name: body.restaurantName,
            address: body.address,
            phone: body.phone,
            currency: body.currency,
            is_open: body.isOpen,
            email_notifications: body.emailNotifications,
            auto_print_receipts: body.autoPrintReceipts,
            automatic_schedule: body.automaticSchedule,
            open_time: body.openTime,
            close_time: body.closeTime
        };

        const { data, error } = await supabase
            .from('settings')
            .upsert(updates)
            .select()
            .single();

        if (error) {
            console.error('Error updating settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Settings POST error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
