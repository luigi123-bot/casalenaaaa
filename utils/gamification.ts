// Hook para agregar puntos después de una compra
export async function addPointsForOrder(userId: string, orderTotal: number, orderId: string) {
    try {
        // Calcular puntos: 1 punto por cada $10 gastados
        const pointsEarned = Math.floor(orderTotal / 10);

        if (pointsEarned <= 0) return;

        const response = await fetch('/api/gamification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add_points',
                userId,
                points: pointsEarned,
                reason: `Compra realizada - $${orderTotal}`,
                orderId
            })
        });

        const data = await response.json();

        if (response.ok) {
            return {
                success: true,
                pointsEarned,
                newTotal: data.newTotal,
                newLevel: data.newLevel
            };
        }

        return { success: false };
    } catch (error) {
        console.error('Error adding points:', error);
        return { success: false };
    }
}

// Función para aplicar cupón de descuento
export async function applyCoupon(couponCode: string, orderTotal: number) {
    try {
        // Aquí deberías validar el cupón contra la base de datos
        // Por ahora, retornamos un ejemplo
        return {
            valid: true,
            discount: 0,
            message: 'Cupón aplicado'
        };
    } catch (error) {
        return {
            valid: false,
            discount: 0,
            message: 'Cupón inválido'
        };
    }
}
