import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// GET - Obtener información de gamificación del usuario
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const mode = searchParams.get('mode');

        // MODE: RANKING - Get Leaderboard
        if (mode === 'ranking') {
            // 1. Get Top Points
            const { data: rankingPoints, error: rankingError } = await supabaseAdmin
                .from('user_points')
                .select('user_id, total_points, current_level')
                .order('total_points', { ascending: false })
                .limit(50);

            if (rankingError) throw rankingError;

            // 2. Get User Profiles manually (since FK might be missing)
            const userIds = rankingPoints.map((r: any) => r.user_id);

            const { data: profiles, error: profilesError } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (profilesError) console.error('Error fetching profiles for ranking:', profilesError);

            // 3. Merge Data
            const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]));

            const formattedRanking = rankingPoints.map((entry: any, index: number) => {
                const profile: any = profilesMap.get(entry.user_id);
                return {
                    rank: index + 1,
                    user_id: entry.user_id,
                    full_name: profile?.full_name || 'Usuario',
                    email: profile?.email,
                    points: entry.total_points,
                    level: entry.current_level
                };
            });

            return NextResponse.json(formattedRanking);
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Obtener puntos del usuario
        let { data: userPoints, error: pointsError } = await supabaseAdmin
            .from('user_points')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Si no existe, crear registro inicial
        if (!userPoints) {
            const { data: newPoints, error: createError } = await supabaseAdmin
                .from('user_points')
                .insert([{ user_id: userId, total_points: 0, current_level: 'bronce', points_to_next_level: 200 }])
                .select()
                .single();

            if (createError) throw createError;
            userPoints = newPoints;
        }

        // Obtener historial de puntos
        const { data: pointsHistory } = await supabaseAdmin
            .from('points_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        // Obtener cupones del usuario
        const { data: userCoupons } = await supabaseAdmin
            .from('user_coupons')
            .select('*, rewards(*)')
            .eq('user_id', userId)
            .eq('is_used', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        // Obtener logros desbloqueados
        const { data: userAchievements } = await supabaseAdmin
            .from('user_achievements')
            .select('*, achievements(*)')
            .eq('user_id', userId)
            .order('unlocked_at', { ascending: false });

        // Obtener recompensas disponibles
        const { data: availableRewards } = await supabaseAdmin
            .from('rewards')
            .select('*')
            .eq('is_active', true)
            .order('points_cost', { ascending: true });

        return NextResponse.json({
            points: userPoints,
            history: pointsHistory || [],
            coupons: userCoupons || [],
            achievements: userAchievements || [],
            availableRewards: availableRewards || []
        });

    } catch (error: any) {
        console.error('Error fetching gamification data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Agregar puntos o canjear recompensa
export async function POST(request: Request) {
    try {
        const { action, userId, points, reason, orderId, rewardId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (action === 'add_points') {
            // Agregar puntos al usuario
            const { data: currentPoints } = await supabaseAdmin
                .from('user_points')
                .select('total_points')
                .eq('user_id', userId)
                .single();

            const newTotal = (currentPoints?.total_points || 0) + points;

            // Calcular nuevo nivel
            let newLevel = 'bronce';
            let pointsToNext = 200;

            if (newTotal >= 1000) {
                newLevel = 'platino';
                pointsToNext = 0;
            } else if (newTotal >= 500) {
                newLevel = 'oro';
                pointsToNext = 1000 - newTotal;
            } else if (newTotal >= 200) {
                newLevel = 'plata';
                pointsToNext = 500 - newTotal;
            } else {
                pointsToNext = 200 - newTotal;
            }

            // Actualizar puntos
            const { error: updateError } = await supabaseAdmin
                .from('user_points')
                .upsert({
                    user_id: userId,
                    total_points: newTotal,
                    current_level: newLevel,
                    points_to_next_level: pointsToNext
                });

            if (updateError) throw updateError;

            // Registrar en historial
            await supabaseAdmin
                .from('points_history')
                .insert([{
                    user_id: userId,
                    points: points,
                    reason: reason || 'Compra realizada',
                    order_id: orderId
                }]);

            // Verificar logros
            await checkAndUnlockAchievements(userId);

            return NextResponse.json({ success: true, newTotal, newLevel });

        } else if (action === 'redeem_reward') {
            // Canjear recompensa
            const { data: reward } = await supabaseAdmin
                .from('rewards')
                .select('*')
                .eq('id', rewardId)
                .single();

            if (!reward) {
                return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
            }

            const { data: userPoints } = await supabaseAdmin
                .from('user_points')
                .select('total_points')
                .eq('user_id', userId)
                .single();

            if (!userPoints || userPoints.total_points < reward.points_cost) {
                return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
            }

            // Generar código de cupón único
            const couponCode = `${reward.name.substring(0, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + reward.valid_days);

            // Crear cupón
            const { data: coupon, error: couponError } = await supabaseAdmin
                .from('user_coupons')
                .insert([{
                    user_id: userId,
                    reward_id: rewardId,
                    code: couponCode,
                    discount_type: reward.discount_type,
                    discount_value: reward.discount_value,
                    min_purchase: reward.min_purchase,
                    expires_at: expiresAt.toISOString()
                }])
                .select()
                .single();

            if (couponError) throw couponError;

            // Descontar puntos
            const newTotal = userPoints.total_points - reward.points_cost;
            await supabaseAdmin
                .from('user_points')
                .update({ total_points: newTotal })
                .eq('user_id', userId);

            // Registrar en historial
            await supabaseAdmin
                .from('points_history')
                .insert([{
                    user_id: userId,
                    points: -reward.points_cost,
                    reason: `Canjeado: ${reward.name}`
                }]);

            return NextResponse.json({ success: true, coupon });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Error in gamification action:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Función auxiliar para verificar y desbloquear logros
async function checkAndUnlockAchievements(userId: string) {
    try {
        // Obtener estadísticas del usuario
        const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('total_amount')
            .eq('user_id', userId);

        const ordersCount = orders?.length || 0;
        const totalSpent = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

        const { data: userPoints } = await supabaseAdmin
            .from('user_points')
            .select('total_points')
            .eq('user_id', userId)
            .single();

        const pointsEarned = userPoints?.total_points || 0;

        // Obtener todos los logros
        const { data: achievements } = await supabaseAdmin
            .from('achievements')
            .select('*');

        // Obtener logros ya desbloqueados
        const { data: unlockedAchievements } = await supabaseAdmin
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId);

        const unlockedIds = new Set(unlockedAchievements?.map(a => a.achievement_id) || []);

        // Verificar cada logro
        for (const achievement of achievements || []) {
            if (unlockedIds.has(achievement.id)) continue;

            let shouldUnlock = false;

            if (achievement.requirement_type === 'orders_count' && ordersCount >= achievement.requirement_value) {
                shouldUnlock = true;
            } else if (achievement.requirement_type === 'total_spent' && totalSpent >= achievement.requirement_value) {
                shouldUnlock = true;
            } else if (achievement.requirement_type === 'points_earned' && pointsEarned >= achievement.requirement_value) {
                shouldUnlock = true;
            }

            if (shouldUnlock) {
                // Desbloquear logro
                await supabaseAdmin
                    .from('user_achievements')
                    .insert([{
                        user_id: userId,
                        achievement_id: achievement.id
                    }]);

                // Otorgar puntos de recompensa
                if (achievement.points_reward > 0) {
                    const { data: current } = await supabaseAdmin
                        .from('user_points')
                        .select('total_points')
                        .eq('user_id', userId)
                        .single();

                    await supabaseAdmin
                        .from('user_points')
                        .update({ total_points: (current?.total_points || 0) + achievement.points_reward })
                        .eq('user_id', userId);

                    await supabaseAdmin
                        .from('points_history')
                        .insert([{
                            user_id: userId,
                            points: achievement.points_reward,
                            reason: `Logro desbloqueado: ${achievement.name}`
                        }]);
                }
            }
        }
    } catch (error) {
        console.error('Error checking achievements:', error);
    }
}
