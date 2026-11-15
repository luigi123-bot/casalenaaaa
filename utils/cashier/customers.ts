import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerUpsertInput {
    phone: string;
    fullName?: string | null;
    address?: string | null;
    minDigits?: number;
}

function normalizeName(name: string | null | undefined): string {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Safely inserts or updates a customer by normalized digit-only phone.
 * Prevents overwriting an existing customer's name when a different person uses the same phone.
 */
export async function upsertCustomerSafe(
    supabase: SupabaseClient,
    { phone, fullName, address, minDigits = 7 }: CustomerUpsertInput
) {
    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length < minDigits) {
        return { skipped: true as const, customer: null };
    }

    const { data: existingCustomer, error: lookupError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phoneClean)
        .maybeSingle();

    if (lookupError) throw lookupError;

    const nowISO = new Date().toISOString();
    const trimmedName = fullName?.trim() || '';
    const trimmedAddress = address?.trim() || '';

    if (existingCustomer) {
        const normExisting = normalizeName(existingCustomer.full_name);
        const normNew = normalizeName(trimmedName);
        const nameMatches =
            normExisting === normNew ||
            normExisting === 'sin nombre' ||
            normExisting === '';

        if (!nameMatches) {
            console.log(
                `⚠️ [CustomerUpsert] Phone ${phoneClean} already belongs to '${existingCustomer.full_name}'. Skipping update to '${trimmedName}' to avoid overwrite.`
            );
            return { skipped: false as const, customer: existingCustomer };
        }

        const { data: updatedData, error: updateError } = await supabase
            .from('customers')
            .update({
                full_name: trimmedName || existingCustomer.full_name,
                address: trimmedAddress || existingCustomer.address,
                last_order_at: nowISO,
            })
            .eq('id', existingCustomer.id)
            .select()
            .single();

        if (updateError) throw updateError;
        return { skipped: false as const, customer: updatedData };
    }

    const { data: insertedData, error: insertError } = await supabase
        .from('customers')
        .insert({
            phone: phoneClean,
            full_name: trimmedName || 'Cliente Nuevo',
            address: trimmedAddress,
            last_order_at: nowISO,
        })
        .select()
        .single();

    if (insertError) throw insertError;
    return { skipped: false as const, customer: insertedData };
}

