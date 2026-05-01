'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

type Message = {
    id: string;
    content: string;
    sender_type: 'cashier' | 'support';
    sender_name: string;
    image_url?: string;
    created_at: string;
};

type Session = {
    id: string;
    cashier_name: string;
    status: string;
    created_at: string;
};

export default function AdminChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const router = useRouter();
    
    const [session, setSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const loadChat = async () => {
            // Cargar sesión
            const { data: sessionData } = await supabase
                .from('support_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (sessionData) {
                setSession(sessionData);
            } else {
                alert('Sesión de chat no encontrada');
                return;
            }

            // Cargar mensajes
            const { data: messagesData } = await supabase
                .from('support_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (messagesData) {
                setMessages(messagesData);
            }
            setLoading(false);

            // Suscribirse a nuevos mensajes
            const channel = supabase
                .channel(`admin_chat_${sessionId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'support_messages',
                    filter: `session_id=eq.${sessionId}`
                }, (payload: any) => {
                    setMessages(prev => [...prev, payload.new as Message]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        loadChat();
    }, [sessionId]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !session) return;

        const messageText = newMessage;
        setNewMessage(''); // Limpiar input rápido para mejor UX

        const { error } = await supabase
            .from('support_messages')
            .insert({
                session_id: sessionId,
                content: messageText,
                sender_type: 'support',
                sender_name: 'Soporte Técnico'
            });

        if (error) {
            console.error('Error enviando respuesta:', error);
            alert('Error al enviar el mensaje');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fcfbf9] flex items-center justify-center">
                <div className="size-10 border-4 border-[#F7941D]/30 border-t-[#F7941D] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fcfbf9] flex flex-col">
            {/* Header */}
            <div className="bg-[#181511] p-6 text-white shadow-md flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-[#F7941D] tracking-tight">Soporte Técnico</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Atendiendo a: <span className="text-white font-bold">{session?.cashier_name}</span>
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/admin/dashboard')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-bold text-sm"
                >
                    Volver al Panel
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 font-medium">No hay mensajes en esta sesión.</div>
                ) : (
                    messages.map((msg, idx) => {
                        const isSupport = msg.sender_type === 'support';
                        return (
                            <div key={idx} className={`flex flex-col ${isSupport ? 'items-end' : 'items-start'}`}>
                                <span className="text-[11px] text-gray-400 font-bold mb-1 ml-1">
                                    {msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <div className={`relative max-w-[85%] sm:max-w-[70%] px-5 py-3.5 rounded-2xl ${
                                    isSupport 
                                        ? 'bg-[#F7941D] text-white rounded-br-sm shadow-[0_4px_15px_-3px_rgba(247,148,29,0.3)]' 
                                        : 'bg-white text-[#181511] rounded-bl-sm shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] border border-gray-100'
                                }`}>
                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                                        {msg.content}
                                    </p>
                                    
                                    {msg.image_url && (
                                        <div className="mt-3 overflow-hidden rounded-xl bg-black/5 ring-1 ring-black/10">
                                            <a href={msg.image_url} target="_blank" rel="noreferrer">
                                                <img 
                                                    src={msg.image_url} 
                                                    alt="Evidencia adjunta" 
                                                    className="max-w-full h-auto max-h-[300px] object-contain hover:scale-105 transition-transform duration-500"
                                                />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Dock */}
            <div className="p-6 bg-white border-t border-gray-100">
                <div className="max-w-4xl w-full mx-auto relative flex items-end gap-3">
                    <div className="flex-1 bg-[#fcfbf9] border border-gray-200 rounded-2xl relative transition-all focus-within:ring-4 focus-within:ring-[#F7941D]/10 focus-within:border-[#F7941D]/30">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Escribe tu respuesta al cajero..."
                            rows={1}
                            className="w-full bg-transparent py-4 px-5 outline-none resize-none text-[15px] font-bold text-[#181511] placeholder-gray-400 min-h-[56px] max-h-[200px] leading-relaxed"
                        />
                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="h-[56px] px-8 bg-[#181511] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-[#2a251e] active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                        <span>Responder</span>
                        <span className="material-icons-round text-lg">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
