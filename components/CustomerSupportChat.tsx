'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

interface Message {
    id: number;
    sender: 'client' | 'admin';
    message: string;
    created_at: string;
}

export default function CustomerSupportChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [hasUnread, setHasUnread] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Refs for stale closure prevention in callbacks
    const isOpenRef = useRef(isOpen);

    useEffect(() => {
        isOpenRef.current = isOpen;
        if (isOpen) {
            setHasUnread(false);
            setTimeout(scrollToBottom, 50);
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 1. Auth Check
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch name if possible, or use 'Cliente'
                const { data: profile } = await supabase.from('usuarios').select('full_name').eq('id', user.id).single();
                setUserName(profile?.full_name || user.email || 'Cliente');
            }
        };
        checkUser();
    }, []);

    // 2. Data Fetching & Subscription & Polling
    useEffect(() => {
        if (!userId) return;

        console.log('--- Initializing Chat for User:', userId);

        // Initial Fetch
        fetchMessages(userId);

        // Realtime Subscription
        const channel = supabase
            .channel(`chat_customer_${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const newMsg = payload.new as Message;
                    console.log('--- Realtime msg received:', newMsg);

                    setMessages((prev) => {
                        // Prevent duplicates
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });

                    // Use Ref to check current open status
                    if (newMsg.sender === 'admin' && !isOpenRef.current) {
                        setHasUnread(true);
                        try {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2346/2346-preview.mp3');
                            audio.play().catch(() => { });
                        } catch (e) { }
                    }
                    setTimeout(scrollToBottom, 100);
                }
            )
            .subscribe((status) => {
                console.log(`--- Subscription status detected: ${status}`);
            });

        // Polling Fallback (every 3 seconds)
        const pollInterval = setInterval(() => {
            fetchMessages(userId);
        }, 3000);

        return () => {
            console.log('--- Cleaning up chat subscription ---');
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [userId]);

    const fetchMessages = async (uid: string) => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return;
        }

        if (data) {
            setMessages(prev => {
                // If the data is identical (by length and last ID), don't update to avoid flicker? 
                // Or just update. React is efficient.
                // Simple equality check to reduce re-renders
                if (data.length === prev.length && data.length > 0 && data[data.length - 1].id === prev[prev.length - 1].id) {
                    return prev;
                }
                return data;
            });
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !userId) return;

        const msgContent = newMessage.trim();
        setNewMessage('');

        // Optimistic
        const tempId = Date.now();
        const optimisticMsg: Message = {
            id: tempId,
            sender: 'client',
            message: msgContent,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(scrollToBottom, 50);

        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .insert({
                    user_id: userId,
                    customer_name: userName,
                    sender: 'client',
                    message: msgContent
                })
                .select()
                .single();

            if (error) throw error;

            // Replace optimistic with real
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));

        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId)); // remove failed
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (!userId) return null; // Don't show if not logged in

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">

            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white pointer-events-auto rounded-3xl shadow-2xl border border-gray-100 w-[350px] h-[500px] mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300">
                    {/* Header */}
                    <div className="bg-[#181511] p-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
                                <span className="material-symbols-outlined text-white">support_agent</span>
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#181511] rounded-full"></span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">Soporte Casa Leña</h3>
                                <p className="text-white/60 text-xs flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    En línea
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/50 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center py-10 opacity-50">
                                <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                                <p className="text-sm">¡Hola! ¿En qué podemos ayudarte hoy?</p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`
                                        max-w-[80%] rounded-2xl p-3 text-sm shadow-sm
                                        ${msg.sender === 'client'
                                            ? 'bg-[#F27405] text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
                                    `}
                                >
                                    {msg.message}
                                    <div
                                        className={`text-[10px] mt-1 text-right
                                            ${msg.sender === 'client' ? 'text-white/70' : 'text-gray-400'}
                                        `}
                                    >
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe tu mensaje..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#F27405] focus:ring-1 focus:ring-[#F27405] transition-all text-black"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-[#181511] text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F27405] transition-colors disabled:opacity-50 disabled:hover:bg-[#181511]"
                            >
                                <span className="material-symbols-outlined text-[20px]">send</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto group relative w-14 h-14 bg-[#181511] rounded-full shadow-lg hover:shadow-2xl hover:scale-105 hover:bg-[#F27405] transition-all flex items-center justify-center"
            >
                {hasUnread && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
                <span
                    className={`material-symbols-outlined text-white text-2xl transition-transform duration-300 ${isOpen ? 'rotate-90 scale-0 absolute' : 'scale-100'}`}
                >
                    chat_bubble
                </span>
                <span
                    className={`material-symbols-outlined text-white text-2xl transition-transform duration-300 ${isOpen ? 'scale-100' : '-rotate-90 scale-0 absolute'}`}
                >
                    close
                </span>
            </button>
        </div>
    );
}
