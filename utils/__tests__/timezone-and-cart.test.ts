import { describe, it, expect } from 'vitest';
import {
    getMexicoDayStartISO,
    getMexicoHour,
    roundCurrency,
} from '@/utils/timezone';
import { escapeHtml } from '@/utils/html';
import { parseOrderItemExtras, mapOrderItemsToCart } from '@/utils/cashier/cart';

describe('timezone, currency & html utilities', () => {
    it('computes Mexico City day start correctly before and after UTC midnight transition', () => {
        // 03:30 UTC on Nov 15 is 21:30 on Nov 14 in Mexico City (UTC-6)
        const lateNightMexico = new Date('2026-11-15T03:30:00.000Z');
        expect(getMexicoDayStartISO(lateNightMexico)).toBe('2026-11-14T06:00:00.000Z');

        // 06:00 UTC on Nov 15 is 00:00 on Nov 15 in Mexico City
        const midnightMexico = new Date('2026-11-15T06:00:00.000Z');
        expect(getMexicoDayStartISO(midnightMexico)).toBe('2026-11-15T06:00:00.000Z');
    });

    it('extracts Mexico City hour and returns null for invalid dates', () => {
        expect(getMexicoHour(new Date('2026-11-15T00:15:00.000Z'))).toBe(18);
        expect(getMexicoHour(new Date('2026-11-15T06:15:00.000Z'))).toBe(0);
        expect(getMexicoHour(new Date('not-a-date'))).toBeNull();
    });

    it('rounds currency without IEEE-754 drift or -0', () => {
        expect(roundCurrency(0.1 + 0.2 - 0.3)).toBe(0);
        expect(Object.is(roundCurrency(-0.001), 0)).toBe(true);
        expect(roundCurrency(123.456)).toBe(123.46);
        expect(roundCurrency(Number.NaN)).toBe(0);
    });

    it('escapes HTML special characters safely', () => {
        expect(escapeHtml(`<script>alert("x&'y")</script>`)).toBe(
            '&lt;script&gt;alert(&quot;x&amp;&#39;y&quot;)&lt;/script&gt;'
        );
    });
});

describe('cart mapping helpers', () => {
    it('separates string extras from embedded half-and-half metadata without duplicating objects', () => {
        const raw = JSON.stringify([
            'extra_cheese',
            {
                type: 'half_and_half',
                second_half_id: 22,
                second_half_name: 'Hawaiana',
                second_half_price: 180,
            },
            'extra_sauce',
        ]);

        const parsed = parseOrderItemExtras(raw);
        expect(parsed.extraIds).toEqual(['extra_cheese', 'extra_sauce']);
        expect(parsed.halfAndHalf).toEqual({ id: 22, name: 'Hawaiana', price: 180 });
    });

    it('maps order items to cart items with half-and-half restored and safe UUIDs', () => {
        const items = mapOrderItemsToCart([
            {
                product_id: 10,
                product_name: 'Mitad Pepperoni / Mitad Hawaiana',
                unit_price: 190,
                quantity: 2,
                selected_size: 'Grande',
                extras: [
                    'extra_cheese',
                    {
                        type: 'half_and_half',
                        second_half_id: 22,
                        second_half_name: 'Hawaiana',
                        second_half_price: 180,
                    },
                ],
                notes: 'Sin cebolla',
            },
        ]);

        expect(items).toHaveLength(1);
        expect(items[0].extras).toEqual(['extra_cheese']);
        expect(items[0].isHalfAndHalf).toBe(true);
        expect(items[0].secondHalfVariant).toEqual({ id: 22, name: 'Hawaiana', price: 180 });
        expect(items[0].cartItemId).toBeTruthy();
        expect(items[0]._originalProductId).toBe(10);
    });
});

