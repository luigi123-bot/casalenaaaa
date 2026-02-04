'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
    id: number;
    content: string;
    sender_type: 'cashier' | 'support';
    created_at: string;
    sender_name?: string;
}

export default function CashierSupportChat({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        initializeChatSession();
    }, []);

    useEffect(() => {
        if (sessionId) {
            fetchMessages();
            subscribeToMessages();
        }
    }, [sessionId]);

    const initializeChatSession = async () => {
        // Check if there's an active session
        const { data: existingSession } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('cashier_id', user?.id)
            .eq('status', 'active')
            .single();

        if (existingSession) {
            setSessionId(existingSession.id);
        } else {
            // Create new session
            const { data: newSession } = await supabase
                .from('chat_sessions')
                .insert({
                    cashier_id: user?.id,
                    cashier_name: user?.full_name,
                    status: 'active'
                })
                .select()
                .single();

            if (newSession) {
                setSessionId(newSession.id);
            }
        }
    };

    const fetchMessages = async () => {
        if (!sessionId) return;

        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data);
        }
    };

    const subscribeToMessages = () => {
        if (!sessionId) return;

        const channel = supabase
            .channel(`chat_${sessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `session_id=eq.${sessionId}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);

                // Scroll to bottom
                setTimeout(() => {
                    const container = document.getElementById('chat-messages');
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                }, 100);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !sessionId) return;

        setLoading(true);
        const { error } = await supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                content: newMessage,
                sender_type: 'cashier',
                sender_name: user?.full_name
            });

        if (!error) {
            setNewMessage('');
        }
        setLoading(false);
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
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md h-full sm:h-[600px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-[#181511] to-[#2d2520] text-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-[#F7941D] rounded-full flex items-center justify-center">
                                <span className="material-icons-round">support_agent</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black">Chat de Soporte</h3>
                                <div className="flex items-center gap-2 text-xs text-white/70">
                                    <span className="size-2 bg-green-400 rounded-full animate-pulse"></span>
                                    <span>En línea</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <span className="material-icons-round text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    id="chat-messages"
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f7f5] custom-scrollbar"
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-8">
                            <div className="size-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                                <span className="material-icons-round text-4xl text-[#F7941D]">chat_bubble_outline</span>
                            </div>
                            <h4 className="font-black text-lg text-[#181511] mb-2">¿Necesitas ayuda?</h4>
                            <p className="text-sm text-[#8c785f]">
                                Envía un mensaje y nuestro equipo de soporte te responderá pronto.
                            </p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender_type === 'cashier' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.sender_type === 'cashier'
                                            ? 'bg-[#F7941D] text-white rounded-br-md'
                                            : 'bg-white text-[#181511] rounded-bl-md border border-gray-100'
                                        }`}
                                >
                                    {message.sender_type === 'support' && (
                                        <p className="text-[10px] font-black uppercase tracking-wider mb-1 opacity-60">
                                            {message.sender_name || 'Soporte'}
                                        </p>
                                    )}
                                    <p className="text-sm font-medium whitespace-pre-wrap break-words">
                                        {message.content}
                                    </p>
                                    <p className={`text-[10px] mt-1 ${message.sender_type === 'cashier'
                                            ? 'text-white/70'
                                            : 'text-gray-400'
                                        }`}>
                                        {formatTime(message.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="flex gap-2">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Escribe tu mensaje..."
                            rows={1}
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F7941D] focus:border-transparent text-sm font-medium text-[#181511] placeholder-gray-400"
                            style={{ maxHeight: '100px' }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || loading}
                            className="size-12 shrink-0 bg-[#F7941D] text-white rounded-xl flex items-center justify-center hover:bg-[#e8891a] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            <span className="material-icons-round">
                                {loading ? 'hourglass_empty' : 'send'}
                            </span>
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                        Presiona Enter para enviar • Shift+Enter para nueva línea
                    </p>
                </div>
            </div>
        </div>
    );
}
