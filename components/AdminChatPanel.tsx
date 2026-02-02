'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

interface ChatMessage {
    id: number;
    created_at: string;
    user_id: string;
    customer_name: string;
    sender: 'client' | 'admin';
    message: string;
    is_read: boolean;
}

interface Conversation {
    userId: string;
    userName: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
}

export default function AdminChatPanel({ onClose, preselectedUserId }: { onClose: () => void, preselectedUserId?: string | null }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [reply, setReply] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Use a ref to access the current selected user inside the subscription callback
    const selectedUserRef = useRef<string | null>(null);

    useEffect(() => {
        selectedUserRef.current = selectedUserId;
    }, [selectedUserId]);

    // Handle initial preselection
    useEffect(() => {
        if (preselectedUserId) {
            setSelectedUserId(preselectedUserId);
            loadConversation(preselectedUserId);
        }
    }, [preselectedUserId]);

    // Initial load and Realtime Subscription
    useEffect(() => {
        fetchConversations();

        const channel = supabase
            .channel('admin_chat_global')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
                const newMsg = payload.new as ChatMessage;

                // 1. Update messages list if this chat is open
                if (selectedUserRef.current === newMsg.user_id) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });

                    if (newMsg.sender === 'client') {
                        markAsRead(newMsg.user_id);
                    }
                }

                // 2. Update conversation list
                setConversations(prev => {
                    const existingIdx = prev.findIndex(c => c.userId === newMsg.user_id);
                    let newConvs = [...prev];

                    if (existingIdx >= 0) {
                        const conv = { ...newConvs[existingIdx] };
                        conv.lastMessage = newMsg.message;
                        conv.lastTime = newMsg.created_at;

                        if (newMsg.sender === 'client' && selectedUserRef.current !== newMsg.user_id) {
                            conv.unreadCount += 1;
                        }

                        newConvs.splice(existingIdx, 1);
                        newConvs.unshift(conv);
                    } else {
                        newConvs.unshift({
                            userId: newMsg.user_id,
                            userName: newMsg.customer_name || 'Nuevo Cliente',
                            lastMessage: newMsg.message,
                            lastTime: newMsg.created_at,
                            unreadCount: newMsg.sender === 'client' ? 1 : 0
                        });
                    }
                    return newConvs;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchConversations = async () => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !data) return;

            const convMap = new Map<string, Conversation>();
            data.forEach((msg: ChatMessage) => {
                if (!convMap.has(msg.user_id)) {
                    convMap.set(msg.user_id, {
                        userId: msg.user_id,
                        userName: msg.customer_name || 'Cliente',
                        lastMessage: msg.message,
                        lastTime: msg.created_at,
                        unreadCount: 0
                    });
                }
                if (!msg.is_read && msg.sender === 'client') {
                    const conv = convMap.get(msg.user_id)!;
                    conv.unreadCount++;
                }
            });

            const sortedConversations = Array.from(convMap.values());
            setConversations(sortedConversations);

            // If we have a preselected user, ensure they are in the list or loaded
            if (preselectedUserId && !convMap.has(preselectedUserId)) {
                // If the user isn't in history yet, they might be new. loadConversation handles fetching.
                loadConversation(preselectedUserId);
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
        }
    };

    const loadConversation = async (userId: string) => {
        setSelectedUserId(userId);

        setConversations(prev => prev.map(c =>
            c.userId === userId ? { ...c, unreadCount: 0 } : c
        ));

        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
        await markAsRead(userId);
    };

    const markAsRead = async (userId: string) => {
        await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('sender', 'client');
    };

    const sendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || !selectedUserId) return;

        const content = reply.trim();
        setReply('');

        const tempMsg: ChatMessage = {
            id: Date.now(),
            created_at: new Date().toISOString(),
            user_id: selectedUserId,
            customer_name: 'Soporte',
            sender: 'admin',
            message: content,
            is_read: true
        };
        setMessages(prev => [...prev, tempMsg]);

        const { error } = await supabase.from('chat_messages').insert({
            user_id: selectedUserId,
            sender: 'admin',
            message: content,
            customer_name: 'Soporte'
        });

        if (error) console.error('Failed to send', error);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex overflow-hidden border border-gray-100 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-50 shadow-md"
                    aria-label="Cerrar chat"
                >
                    <span className="material-symbols-outlined text-gray-600 text-xl font-bold">close</span>
                </button>

                {/* Sidebar */}
                <div className="w-full sm:w-[350px] bg-gray-50 border-r border-gray-200 flex flex-col">
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
                        <h2 className="font-bold text-xl text-gray-900">Mensajes</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                No hay conversaciones recientes
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <button
                                    key={conv.userId}
                                    onClick={() => loadConversation(conv.userId)}
                                    className={`w-full p-4 flex items-start space-x-3 transition-all duration-200
                                        ${selectedUserId === conv.userId
                                            ? 'bg-white border-l-4 border-[#F27405] shadow-sm'
                                            : 'border-l-4 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
                                        ${selectedUserId === conv.userId ? 'bg-[#F27405] text-white' : 'bg-gray-200 text-gray-600'}
                                    `}>
                                        {conv.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className={`text-sm font-semibold truncate ${selectedUserId === conv.userId ? 'text-gray-900' : 'text-gray-700'}`}>
                                                {conv.userName}
                                            </h4>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                {formatTime(conv.lastTime)}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate ${selectedUserId === conv.userId ? 'text-gray-600' : 'text-gray-500'}`}>
                                            {conv.lastMessage}
                                        </p>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <div className="min-w-[18px] h-[18px] flex items-center justify-center bg-[#F27405] text-white text-[10px] font-bold rounded-full px-1.5 shadow-sm">
                                            {conv.unreadCount}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white relative">
                    {selectedUserId ? (
                        <>
                            <div className="h-20 px-6 border-b border-gray-100 flex items-center bg-white shadow-sm z-10">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F27405] to-[#f79e4c] flex items-center justify-center text-white font-bold shadow-md">
                                        {conversations.find(c => c.userId === selectedUserId)?.userName.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 leading-tight">
                                            {conversations.find(c => c.userId === selectedUserId)?.userName || 'Cargando...'}
                                        </h3>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            <span className="text-xs text-gray-500 font-medium">En línea</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAFAFA]">
                                {messages.map((msg, index) => {
                                    const isFirst = index === 0 || messages[index - 1].sender !== msg.sender;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}
                                        >
                                            {isFirst && msg.sender === 'client' && (
                                                <span className="text-[10px] text-gray-400 ml-4 mb-1">
                                                    {msg.customer_name}
                                                </span>
                                            )}
                                            <div
                                                className={`
                                                    max-w-[70%] px-4 py-3 text-sm shadow-sm relative group
                                                    ${msg.sender === 'admin'
                                                        ? 'bg-gradient-to-br from-[#F27405] to-[#FF8C1A] text-white rounded-2xl rounded-tr-sm'
                                                        : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'}
                                                `}
                                            >
                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                <div className={`text-[9px] mt-1 text-right opacity-80 ${msg.sender === 'admin' ? 'text-white' : 'text-gray-400'}`}>
                                                    {formatTime(msg.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100">
                                <form onSubmit={sendReply} className="flex gap-3 max-w-4xl mx-auto">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={reply}
                                            onChange={(e) => setReply(e.target.value)}
                                            placeholder="Escribe un mensaje..."
                                            className="w-full bg-gray-50 border border-gray-200 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:border-[#F27405] focus:ring-1 focus:ring-[#F27405] text-gray-900 transition-all shadow-sm"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!reply.trim()}
                                        className="h-[46px] w-[46px] flex items-center justify-center bg-[#F27405] hover:bg-[#d66503] text-white rounded-full shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined">send</span>
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-gray-400">forum</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Casalena Chat</h3>
                            <p className="text-gray-500 max-w-sm text-center text-sm">
                                Selecciona una conversación de la lista para ver los detalles, responder a clientes y gestionar el soporte.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
