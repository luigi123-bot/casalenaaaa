import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface Message {
    id: number;
    content: string;
    sender_type: 'cashier' | 'support';
    created_at: string;
    sender_name?: string;
    image_url?: string;
}

export default function CashierSupportChat({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const initializeChatSession = useCallback(async () => {
        if (!user?.id) return; // Esperar a que cargue el usuario

        const { data: existingSession } = await supabase
            .from('support_sessions')
            .select('*')
            .eq('cashier_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

        if (existingSession) {
            setSessionId(existingSession.id);
        } else {
            const { data: newSession, error } = await supabase
                .from('support_sessions')
                .insert({
                    cashier_id: user.id,
                    cashier_name: user?.full_name || 'Cajero',
                    status: 'active'
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating chat session:', error);
                alert(`Error crítico de Base de Datos al crear la sesión: ${error.message}. Por favor, asegúrate de haber ejecutado el código SQL correctamente.`);
            }

            if (newSession) {
                setSessionId(newSession.id);
            }
        }
    }, [user?.id, user?.full_name]);

    const fetchMessages = useCallback(async () => {
        if (!sessionId) return;
        const { data } = await supabase
            .from('support_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data);
            setTimeout(scrollToBottom, 100);
        }
    }, [sessionId]);

    const subscribeToMessages = useCallback(() => {
        if (!sessionId) return;
        const channel = supabase
            .channel(`chat_${sessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'support_messages',
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);
                setTimeout(scrollToBottom, 100);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    useEffect(() => {
        initializeChatSession();
    }, [initializeChatSession]);

    useEffect(() => {
        if (sessionId) {
            fetchMessages();
            return subscribeToMessages();
        }
    }, [sessionId, fetchMessages, subscribeToMessages]);

    useAutoRefresh(() => {
        if (sessionId) fetchMessages();
    });

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `support/${sessionId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('support')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('support')
            .getPublicUrl(filePath);

        return data.publicUrl;
    };

    const notifySupport = async (content: string, imageUrl?: string) => {
        try {
            await fetch('/api/support/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashierName: user?.full_name || 'Cajero',
                    message: content,
                    imageUrl,
                    sessionId
                })
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    };

    const sendMessage = async () => {
        if (!sessionId) {
            alert('Error: No se pudo establecer la sesión de chat (sessionId es nulo). Esto suele pasar si falta actualizar la base de datos (SQL) o crear el bucket.');
            return;
        }
        if ((!newMessage.trim() && !selectedImage) || loading) return;

        setLoading(true);
        try {
            let imageUrl = undefined;
            if (selectedImage) {
                setUploading(true);
                imageUrl = await uploadImage(selectedImage);
                setUploading(false);
            }

            const { error } = await supabase
                .from('support_messages')
                .insert({
                    session_id: sessionId,
                    content: newMessage,
                    sender_type: 'cashier',
                    sender_name: user?.full_name || 'Cajero',
                    image_url: imageUrl
                });

            if (!error) {
                // Solo enviar correo si es el primer mensaje de la sesión
                if (messages.length === 0) {
                    notifySupport(newMessage, imageUrl);
                }
                
                setNewMessage('');
                setSelectedImage(null);
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                console.error('Error from supabase insert:', error);
                alert(`Error al guardar el mensaje: ${error.message}`);
            }
        } catch (error: any) {
            console.error('Error sending message:', error);
            alert(`Error al enviar: ${error.message || 'No se pudo subir la imagen o enviar el mensaje. Verifica la consola.'}`);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#181511]/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-white w-full sm:max-w-lg h-full sm:h-[720px] sm:rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-white/20 relative">
                
                {/* Glossy Header */}
                <div className="p-6 sm:p-8 bg-[#181511] text-white relative overflow-hidden shrink-0">
                    {/* Animated background element */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#F7941D] opacity-20 blur-[80px] animate-pulse"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-white opacity-5 blur-[60px]"></div>
                    
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4 sm:gap-5">
                            <div className="relative group shrink-0">
                                <div className="size-14 sm:size-16 bg-gradient-to-br from-[#2a2520] to-[#181511] rounded-[1.5rem] sm:rounded-[1.75rem] flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-105 transition-transform duration-300">
                                    <span className="material-icons-round text-[#F7941D] text-2xl sm:text-3xl">support_agent</span>
                                </div>
                                <div className="absolute -bottom-1 -right-1 size-4 sm:size-5 bg-green-500 rounded-full border-[3px] sm:border-[4px] border-[#181511] shadow-lg">
                                    <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-40"></div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-lg sm:text-2xl font-black tracking-tight text-white/95 truncate">Centro de Ayuda</h3>
                                <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                    <div className="flex -space-x-2 shrink-0">
                                        {[1, 2].map(i => (
                                            <div key={i} className="size-4 sm:size-5 rounded-full border-2 border-[#181511] bg-gray-600 overflow-hidden">
                                                <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Support" className="w-full h-full object-cover grayscale" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#F7941D]/90 truncate">Soporte Prioritario</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-10 sm:size-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 hover:text-red-400 transition-all active:scale-90 border border-white/5 shrink-0"
                        >
                            <span className="material-icons-round text-xl sm:text-2xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Messages Area with Glass Pattern */}
                <div
                    id="chat-messages"
                    className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[#fcfbf9] custom-scrollbar relative"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#181511 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-8 sm:px-12 animate-in fade-in zoom-in duration-700">
                            <div className="relative mb-6 sm:mb-10">
                                <div className="absolute inset-0 bg-[#F7941D]/10 blur-[40px] rounded-full scale-150 animate-pulse"></div>
                                <div className="size-24 sm:size-32 bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] flex items-center justify-center relative z-10 border border-gray-50">
                                    <span className="material-icons-round text-5xl sm:text-6xl text-[#F7941D]">forum</span>
                                </div>
                            </div>
                            <h4 className="font-black text-2xl sm:text-3xl text-[#181511] mb-3 sm:mb-4 tracking-tight">¿Cómo podemos asistirte?</h4>
                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-4 text-left">
                                <p className="text-[13px] text-orange-900 font-bold mb-1 flex items-center gap-1.5">
                                    <span className="material-icons-round text-[16px] text-[#F7941D]">tips_and_updates</span>
                                    Consejo para atención rápida
                                </p>
                                <p className="text-xs text-orange-800/80 leading-relaxed font-medium">
                                    Para evitar confusiones, por favor <strong>escribe todo el detalle de tu problema</strong> y <strong>adjunta la captura de pantalla</strong> en un mismo envío.
                                </p>
                            </div>
                            <p className="text-sm sm:text-base text-[#8c785f] font-medium leading-relaxed">
                                Nuestro equipo técnico revisará la evidencia y responderá en tiempo récord.
                            </p>
                        </div>
                    ) : (
                        messages.map((message, idx) => (
                            <div
                                key={message.id}
                                className={`flex flex-col ${message.sender_type === 'cashier' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-300`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div
                                    className={`max-w-[85%] rounded-[2rem] p-4 sm:p-5 shadow-sm relative group ${message.sender_type === 'cashier'
                                        ? 'bg-[#181511] text-white rounded-tr-none shadow-[0_10px_20px_-5px_rgba(0,0,0,0.2)]'
                                        : 'bg-white text-[#181511] rounded-tl-none border border-gray-100 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)]'
                                        }`}
                                >
                                    {message.image_url && (
                                        <div className="mb-4 rounded-2xl overflow-hidden border border-white/5 shadow-inner bg-black/5">
                                            <img 
                                                src={message.image_url} 
                                                alt="Adjunto" 
                                                className="w-full h-auto max-h-72 object-cover transition-all duration-500 hover:scale-105 cursor-zoom-in"
                                                onClick={() => window.open(message.image_url, '_blank')}
                                            />
                                        </div>
                                    )}
                                    {message.content && (
                                        <p className="text-sm sm:text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">
                                            {message.content}
                                        </p>
                                    )}
                                    <div className={`flex items-center gap-2 mt-3 opacity-30 ${message.sender_type === 'cashier' ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {formatTime(message.created_at)}
                                        </span>
                                        {message.sender_type === 'cashier' && (
                                            <span className="material-icons-round text-sm">done_all</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Floating Image Preview */}
                {imagePreview && (
                    <div className="mx-6 mb-4 p-4 bg-[#181511] rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom-4 shadow-2xl border border-white/10 ring-4 sm:ring-8 ring-white/50">
                        <div className="size-14 sm:size-16 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg shrink-0">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-[11px] font-black text-[#F7941D] uppercase tracking-widest mb-1 truncate">Evidencia adjunta</p>
                            <p className="text-[9px] sm:text-[10px] text-white/50 font-bold truncate">{selectedImage?.name}</p>
                        </div>
                        <button 
                            onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                            className="size-9 sm:size-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90 shrink-0"
                        >
                            <span className="material-icons-round text-lg">delete</span>
                        </button>
                    </div>
                )}

                {/* Modern Input Dock */}
                <div className="p-6 sm:p-8 bg-white border-t border-gray-100/50 relative">
                    {/* Security Badge */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm flex items-center gap-2 whitespace-nowrap">
                        <span className="material-icons-round text-[14px] text-green-500">verified_user</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Canal Encriptado</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 bg-gray-50/80 hover:bg-gray-50 transition-colors p-2 sm:p-3 pl-3 sm:pl-4 rounded-[2rem] sm:rounded-[2.25rem] border-2 border-gray-100 focus-within:border-[#F7941D] focus-within:ring-4 focus-within:ring-[#F7941D]/5 transition-all">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="size-10 sm:size-11 shrink-0 bg-white text-[#8c785f] rounded-full flex items-center justify-center hover:text-[#F7941D] hover:shadow-xl transition-all active:scale-90 border border-gray-200 shadow-sm"
                            title="Adjuntar imagen"
                        >
                            <span className="material-icons-round text-2xl">image</span>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageSelect} 
                            className="hidden" 
                            accept="image/*"
                        />
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={selectedImage ? "Añade una descripción para tu imagen..." : "Describe el problema y adjunta imagen si es necesario..."}
                            rows={1}
                            className="flex-1 bg-transparent py-2 sm:py-3 px-1 outline-none resize-none text-sm sm:text-[15px] font-bold text-[#181511] placeholder-gray-400 min-h-[40px] sm:min-h-[44px] max-h-[140px] leading-relaxed"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={(!newMessage.trim() && !selectedImage) || loading || uploading}
                            className={`size-12 sm:size-14 shrink-0 rounded-2xl sm:rounded-[1.25rem] flex items-center justify-center transition-all active:scale-90 shadow-2xl relative group overflow-hidden ${
                                (!newMessage.trim() && !selectedImage) || loading || uploading
                                ? 'bg-gray-200 text-gray-400'
                                : 'bg-[#F7941D] text-white shadow-[#F7941D]/20'
                            }`}
                        >
                            {(loading || uploading) ? (
                                <div className="size-5 sm:size-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-icons-round text-xl sm:text-2xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">send</span>
                            )}
                        </button>
                    </div>
                    <div className="mt-4 sm:mt-6 text-center">
                        <p className="text-[9px] sm:text-[10px] text-gray-300 font-bold tracking-tight truncate">
                            Sistema de Atención Inmediata v3.0 • <span className="text-gray-400">Powered by Casalena Support</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
