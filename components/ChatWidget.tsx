'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { useChat } from 'ai/react';

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    
    const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
        initialMessages: [
            {
                id: 'welcome-1',
                role: 'assistant',
                content: 'Hello! I am the SchoolPulse AI assistant. How can I help you today?',
            }
        ]
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const modelQuestions = [
        "Today's homework",
        "Today's events",
        "What will my kid learn in school today?",
        "What uniform on Monday?",
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, isOpen]);

    const formatText = (text: string) => {
        // Basic markdown-like formatting for links, bold (**text**) and lists (•)
        const lines = text.split('\n');
        return lines.map((line, i) => {
            if (line.trim() === '') return <br key={i} />;

            let parts: React.ReactNode[] = [];
            let lastIndex = 0;

            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let linkMatch;

            while ((linkMatch = linkRegex.exec(line)) !== null) {
                const preText = line.substring(lastIndex, linkMatch.index);
                parts.push(...processBold(preText, `${i}-pre-${linkMatch.index}`));

                parts.push(
                    <a
                        key={`${i}-link-${linkMatch.index}`}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                        {linkMatch[1]}
                    </a>
                );
                lastIndex = linkMatch.index + linkMatch[0].length;
            }

            if (lastIndex < line.length) {
                const postText = line.substring(lastIndex);
                parts.push(...processBold(postText, `${i}-post`));
            }

            return (
                <div key={i} className={line.startsWith('-') || line.startsWith('•') ? "ml-4" : "mt-1"}>
                    {parts.length > 0 ? parts : line}
                </div>
            );
        });
    };

    const processBold = (text: string, keyPrefix: string) => {
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
            }
            parts.push(<strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold">{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={`${keyPrefix}-end`}>{text.substring(lastIndex)}</span>);
        }
        return parts;
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg shadow-orange-200 z-50 transition-all duration-300 flex items-center justify-center transform hover:scale-105 active:scale-95 border-2 border-white
        ${isOpen ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 bg-gradient-to-r from-orange-500 to-rose-500 text-white'}`}
                aria-label="Open Chat"
            >
                <MessageCircle size={28} className="drop-shadow-sm" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white shadow-sm"></span>
                </span>
            </button>

            {/* Chat Window */}
            <div
                className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[320px] h-[70vh] sm:h-[480px] max-h-[calc(100vh-96px)] sm:max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 transform origin-bottom-right focus:outline-none overflow-hidden border border-gray-100
        ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 pointer-events-none translate-y-10'}`}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-rose-500 text-white p-4 flex justify-between items-center rounded-t-2xl shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/30">
                            <Bot size={22} className="text-white drop-shadow-sm" />
                        </div>
                        <div>
                            <h3 className="font-bold tracking-wide text-sm drop-shadow-sm">SchoolPulse AI</h3>
                            <div className="flex items-center gap-1.5 opacity-90">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-[11px] font-medium tracking-wider uppercase">Online</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors backdrop-blur-sm"
                        aria-label="Close chat"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 relative scroll-smooth">
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-rose-100/40 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute top-40 -right-20 w-64 h-64 bg-orange-100/40 rounded-full blur-3xl pointer-events-none"></div>

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} max-w-full relative z-10 animate-fade-in-up`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center text-white p-1.5 mr-2 mt-1 shadow-sm flex-shrink-0">
                                    <Bot size={14} />
                                </div>
                            )}
                            <div
                                className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words
                ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-br-sm'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                                    }`}
                                style={{ maxWidth: '85%' }}
                            >
                                {msg.role === 'assistant' ? formatText(msg.content) : msg.content}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start relative z-10 animate-fade-in">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center text-white p-1.5 mr-2 mt-1 shadow-sm flex-shrink-0">
                                <Bot size={14} />
                            </div>
                            <div className="bg-white border border-gray-100 text-gray-800 p-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center space-x-1.5">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestion Chips */}
                <div className="px-3 pt-3 bg-white border-t border-gray-100 z-10 relative">
                    <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider pl-1">Ask a question:</div>
                    <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar snap-x">
                        {modelQuestions.map((q, idx) => (
                            <button
                                key={idx}
                                onClick={() => append({ role: 'user', content: q })}
                                disabled={isLoading}
                                className="whitespace-nowrap snap-start text-xs bg-slate-50 border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700 px-3 py-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm flex items-center"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Input */}
                <form onSubmit={handleSubmit} className="p-3 bg-white flex items-center gap-2 relative z-10">
                    <input
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-sm px-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Ask me anything..."
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-full disabled:opacity-50 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
            height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 20px;
        }
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
        </>
    );
}
