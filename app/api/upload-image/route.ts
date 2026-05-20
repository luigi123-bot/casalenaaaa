import { NextRequest, NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No se proporcionó ningún archivo' },
                { status: 400 }
            );
        }

        // Generate unique filename and validate file type (only allow image files)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipo de archivo no permitido. Solo se permiten imágenes.' },
                { status: 400 }
            );
        }

        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin.storage
            .from('pizza')
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('pizza')
            .getPublicUrl(fileName);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: fileName
        });

    } catch (error) {
        return handleServerError(error, 'Upload Image API Error');
    }
}

