import React, { useState, useRef, useEffect } from 'react';
import {
    Stack,
    TextInput,
    Button,
    IconButton,
    Tile,
    Loading,
    Tag,
    Layer
} from '@carbon/react';
import { SendAlt, Bot, User, ChatBot } from '@carbon/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/services/api';

interface Message {
    id: string;
    role: 'ai' | 'user';
    content: string;
    timestamp: Date;
}

export default function ChatCopilot() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'ai',
            content: 'Olá! Sou seu Copilot genOS™. Como posso ajudar na produção industrial de conteúdo hoje?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const tenantId = api.getActiveTenantId();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !tenantId) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.callCopilot(tenantId, input);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: res.response || 'Desculpe, não consegui processar essa solicitação.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Copilot call failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-copilot-container">
            <Tile className="chat-header" style={{ borderRadius: '8px 8px 0 0', backgroundColor: '#262626', borderBottom: '1px solid #393939' }}>
                <Stack orientation="horizontal" gap={3} style={{ alignItems: 'center' }}>
                    <div className="pulse-icon">
                        <ChatBot size={20} fill="#8a3ffc" />
                    </div>
                    <div>
                        <h4 className="cds--type-productive-heading-01">genOS™ Chat Copilot</h4>
                        <Tag type="purple" size="sm">RAG Enabled</Tag>
                    </div>
                </Stack>
            </Tile>

            <div className="chat-messages" ref={scrollRef}>
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: msg.role === 'ai' ? -10 : 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`message-bubble ${msg.role}`}
                        >
                            <Stack orientation="horizontal" gap={3} style={{ alignItems: 'flex-start' }}>
                                {msg.role === 'ai' ? <Bot size={16} fill="#8a3ffc" /> : <User size={16} fill="#08bdba" />}
                                <div className="message-content">
                                    <p className="cds--type-body-short-01">{msg.content}</p>
                                    <span className="timestamp">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </Stack>
                        </motion.div>
                    ))}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="message-bubble ai thinking"
                        >
                            <Stack orientation="horizontal" gap={3}>
                                <Bot size={16} fill="#8a3ffc" />
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </Stack>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <Layer className="chat-input-area" style={{ padding: '1rem', borderTop: '1px solid #393939', backgroundColor: '#161616' }}>
                <Stack orientation="horizontal" gap={2}>
                    <TextInput
                        id="copilot-input"
                        labelText=""
                        placeholder="Pergunte sobre sua estratégia..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={loading}
                    />
                    <IconButton
                        kind="primary"
                        label="Send"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        size="md"
                    >
                        <SendAlt />
                    </IconButton>
                </Stack>
            </Layer>

            <style>{`
                .chat-copilot-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    max-height: 600px;
                    border: 1px solid #393939;
                    background-color: #161616;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .chat-messages {
                    flex: 1;
                    padding: 1rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    background: radial-gradient(circle at 50% 50%, #1a1a1a 0%, #161616 100%);
                }
                .message-bubble {
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    max-width: 85%;
                    line-height: 1.4;
                }
                .message-bubble.ai {
                    align-self: flex-start;
                    background-color: #262626;
                    border-left: 3px solid #8a3ffc;
                }
                .message-bubble.user {
                    align-self: flex-end;
                    background-color: #393939;
                    border-right: 3px solid #08bdba;
                }
                .message-content .timestamp {
                    display: block;
                    font-size: 0.65rem;
                    color: #8d8d8d;
                    margin-top: 0.25rem;
                }
                .typing-indicator span {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    background-color: #8a3ffc;
                    border-radius: 50%;
                    margin-right: 3px;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1.0); }
                }
                .pulse-icon {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
