import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const { cashierName, message, imageUrl, sessionId } = await request.json();

        console.log('[Support-Notify] 🔔 Recibida solicitud de notificación (Nodemailer).');
        console.log(`[Support-Notify] 👤 Remitente: ${cashierName}`);
        console.log(`[Support-Notify] 📝 Mensaje: ${message ? message.substring(0, 20) + '...' : '(Sin texto)'}`);
        console.log(`[Support-Notify] 🔑 Usuario SMTP: ${process.env.SUPPORT_EMAIL_USER ? 'Configurado' : 'NO CONFIGURADO'}`);

        // Configuración de transporte
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SUPPORT_EMAIL_USER,
                pass: process.env.SUPPORT_EMAIL_PASS
            }
        });

        const htmlContent = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background-color: #181511; padding: 30px; text-align: center;">
                    <h1 style="color: #F7941D; margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Alerta de Soporte</h1>
                    <p style="color: #8c785f; margin: 5px 0 0 0; font-size: 12px; font-weight: bold;">SISTEMA POS CASALENA</p>
                </div>
                
                <div style="padding: 40px; background-color: #ffffff;">
                    <div style="margin-bottom: 30px;">
                        <p style="font-size: 14px; color: #8c785f; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Remitente</p>
                        <p style="font-size: 18px; color: #181511; margin: 0; font-weight: 800;">${cashierName}</p>
                    </div>
                    
                    <div style="margin-bottom: 30px; padding: 20px; background-color: #fcfbf9; border-left: 4px solid #F7941D; border-radius: 4px;">
                        <p style="font-size: 14px; color: #8c785f; margin-bottom: 10px; font-weight: bold; text-transform: uppercase;">Mensaje del Cajero</p>
                        <p style="font-size: 16px; color: #181511; line-height: 1.6; margin: 0; font-weight: 500;">
                            ${message || '<i>El cajero envió un archivo adjunto sin texto.</i>'}
                        </p>
                    </div>
                    
                    ${imageUrl ? `
                        <div style="margin-bottom: 30px;">
                            <p style="font-size: 14px; color: #8c785f; margin-bottom: 10px; font-weight: bold; text-transform: uppercase;">Captura de Pantalla / Evidencia</p>
                            <a href="${imageUrl}" target="_blank" style="text-decoration: none;">
                                <img src="${imageUrl}" alt="Evidencia" style="width: 100%; max-width: 100%; border-radius: 12px; border: 1px solid #eee; display: block;" />
                            </a>
                        </div>
                    ` : ''}
                    
                    <div style="border-top: 1px solid #eee; padding-top: 30px; margin-top: 10px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://casalena.netlify.app'}/admin/chat/${sessionId}" style="display: block; background-color: #F7941D; color: #ffffff; text-align: center; padding: 15px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                            Responder en el Panel de Soporte
                        </a>
                    </div>
                </div>
            </div>
        `;

        if (!process.env.SUPPORT_EMAIL_USER || !process.env.SUPPORT_EMAIL_PASS || process.env.SUPPORT_EMAIL_USER.includes('tu_correo')) {
            console.warn('[Support-Notify] ⚠️  La configuración de Nodemailer falta en .env.local.');
            return NextResponse.json({ 
                success: true, 
                message: 'Mensaje procesado, pero el correo no fue enviado (falta configuración de Gmail)' 
            });
        }

        const mailOptions = {
            from: `"Soporte Casalena" <${process.env.SUPPORT_EMAIL_USER}>`,
            to: 'gotopoluis19@gmail.com', // El correo al que llegarán las notificaciones
            subject: `🚨 Nuevo mensaje de Soporte - ${cashierName}`,
            html: htmlContent
        };

        console.log('[Support-Notify] 🚀 Enviando correo vía Nodemailer (Gmail)...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('[Support-Notify] ✅ ¡Correo enviado exitosamente!', info.messageId);
        return NextResponse.json({ success: true, message: 'Notificación enviada con éxito' });

    } catch (error: any) {
        console.error('[Support-Notify] 💥 ERROR en Nodemailer:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

