import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin access (bypasses RLS)
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

export async function POST(request: NextRequest) {
    try {
        console.log('📸 [UPLOAD] Starting image upload...');

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.error('❌ [UPLOAD] No file provided');
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        console.log('📁 [UPLOAD] File details:', {
            name: file.name,
            type: file.type,
            size: `${(file.size / 1024).toFixed(2)} KB`
        });

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        console.log('🔄 [UPLOAD] Generated filename:', fileName);

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('☁️ [UPLOAD] Uploading to Supabase Storage bucket: pizza');

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('pizza')
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ [UPLOAD] Supabase Storage error:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        console.log('✅ [UPLOAD] File uploaded successfully:', data.path);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('pizza')
            .getPublicUrl(fileName);

        console.log('🔗 [UPLOAD] Public URL:', publicUrl);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: fileName
        });

    } catch (error) {
        console.error('💥 [UPLOAD] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to upload image' },
            { status: 500 }
        );
    }
}
