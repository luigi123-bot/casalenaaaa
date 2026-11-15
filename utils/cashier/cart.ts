import { generateUUID } from '@/utils/uuid';

export interface HalfAndHalfMeta {
    type: 'half_and_half';
    second_half_id: number;
    second_half_name: string;
    second_half_price: number;
}

export interface RawOrderItem {
    id?: number;
    product_id?: number | null;
    product_name: string;
    unit_price: number;
    quantity: number;
    selected_size?: string | null;
    extras?: unknown;
    notes?: string | null;
}

export interface MappedCartItem {
    id: number;
    name: string;
    description: string;
    price: number;
    category_id: number;
    imagen_url: string;
    available: boolean;
    quantity: number;
    selectedSize?: string;
    extras: string[];
    note: string;
    cartItemId: string;
    _originalProductId: number | null | undefined;
    isHalfAndHalf?: boolean;
    secondHalfVariant?: {
        id: number;
        name: string;
        price: number;
    };
}

/**
 * Parses `order_items.extras` (array or JSON string) separating plain extra IDs
 * from embedded half-and-half pizza metadata so reopening an order doesn't duplicate it.
 */
export function parseOrderItemExtras(rawExtras: unknown): {
    extraIds: string[];
    halfAndHalf?: { id: number; name: string; price: number };
} {
    let parsedArray: unknown[] = [];

    if (Array.isArray(rawExtras)) {
        parsedArray = rawExtras;
    } else if (typeof rawExtras === 'string' && rawExtras.trim()) {
        try {
            const decoded = JSON.parse(rawExtras);
            if (Array.isArray(decoded)) parsedArray = decoded;
        } catch {
            parsedArray = [];
        }
    }

    const extraIds: string[] = [];
    let halfAndHalf: { id: number; name: string; price: number } | undefined;

    for (const entry of parsedArray) {
        if (typeof entry === 'string') {
            extraIds.push(entry);
        } else if (
            entry &&
            typeof entry === 'object' &&
            (entry as HalfAndHalfMeta).type === 'half_and_half'
        ) {
            const meta = entry as HalfAndHalfMeta;
            halfAndHalf = {
                id: Number(meta.second_half_id),
                name: String(meta.second_half_name || ''),
                price: Number(meta.second_half_price) || 0,
            };
        }
    }

    return { extraIds, halfAndHalf };
}

export function mapOrderItemsToCart(orderItems: RawOrderItem[] | null | undefined): MappedCartItem[] {
    return (orderItems || []).map((item) => {
        const { extraIds, halfAndHalf } = parseOrderItemExtras(item.extras);
        return {
            id: item.product_id ?? 0,
            name: item.product_name,
            description: '',
            price: item.unit_price,
            category_id: 0,
            imagen_url: '/icon.png',
            available: true,
            quantity: item.quantity,
            selectedSize: item.selected_size ?? undefined,
            extras: extraIds,
            note: item.notes || '',
            cartItemId: generateUUID(),
            _originalProductId: item.product_id,
            ...(halfAndHalf
                ? { isHalfAndHalf: true, secondHalfVariant: halfAndHalf }
                : {}),
        };
    });
}

