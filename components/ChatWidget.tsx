'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Bot, Loader2 } from 'lucide-react';
import { getDaySchedule, getWeekForDate, getToday, getUpcomingEvents, getSchoolContactInfo } from '@/lib/data';
import { fetchHomework, fetchExternalUpdates } from '@/app/actions';

type MessageRole = 'user' | 'assistant';

interface Message {
    id: string;
    role: MessageRole;
    text: string;
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome-1',
            role: 'assistant',
            text: 'Hello! I am the SchoolPulse assistant. How can I help you today?',
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const modelQuestions = [
        "Any upcoming homework?",
        "Are there any notices?",
        "What is today's schedule?",
        "What are the dictation words?",
        "Any upcoming events?",
        "How to contact the school?",
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, isOpen]);

    const handleQuestionClick = async (question: string) => {
        // Add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: question,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsTyping(true);

        // Simulate network/processing delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        let answer = "";
        const today = getToday();

        try {
            if (question === "Any upcoming homework?") {
                const homework = await fetchHomework();
                if (homework && homework.length > 0) {
                    answer = "Here is the pending homework:\n\n";
                    homework.forEach((hw) => {
                        answer += `**${hw.subject}**: ${hw.content}\n*Due: ${hw.submissionDate}*\n\n`;
                    });
                } else {
                    answer = "There is no pending homework right now. Enjoy the free time! 🎉";
                }
            }
            else if (question === "Are there any notices?") {
                const updates = await fetchExternalUpdates();
                const notices = updates.filter((u: any) => u.type !== 'homework'); // exclude homework
                if (notices && notices.length > 0) {
                    answer = "Here are the latest notices:\n\n";
                    notices.slice(0, 3).forEach((n: any) => {
                        answer += `**${n.title || n.category}**: ${n.message}\n\n`;
                    });
                    if (notices.length > 3) answer += `*(and ${notices.length - 3} more...)*`
                } else {
                    answer = "There are no new notices at the moment.";
                }
            }
            else if (question === "What is today's schedule?") {
                const schedule = getDaySchedule(today);
                if (schedule && !schedule.isHoliday && schedule.schedule && schedule.schedule.length > 0) {
                    answer = `Here is the schedule for today (${schedule.dayOfWeek}):\n\n`;
                    schedule.schedule.forEach(item => {
                        answer += `• **${item.time}**: ${item.subject}\n`;
                    });
                } else if (schedule && schedule.isHoliday) {
                    answer = `Today is a holiday: ${schedule.holidayName || 'Enjoy your day off!'}`;
                } else {
                    answer = "I don't have the schedule for today. It might be a weekend.";
                }
            }
            else if (question === "What are the dictation words?") {
                const weekInfo = getWeekForDate(today);
                if (weekInfo && weekInfo.dictationWords && weekInfo.dictationWords.length > 0) {
                    answer = `The dictation words for this week are:\n\n${weekInfo.dictationWords.join(', ')}`;
                    if (weekInfo.dictationSentences && weekInfo.dictationSentences.length > 0) {
                        answer += `\n\n**Sentences:**\n`;
                        weekInfo.dictationSentences.forEach(s => answer += `• ${s}\n`);
                    }
                } else {
                    answer = "There are no dictation words currently assigned for this week.";
                }
            }
            else if (question === "Any upcoming events?") {
                const events = getUpcomingEvents(14); // Next 14 days
                if (events && events.length > 0) {
                    answer = "Here are the upcoming events in the next two weeks:\n\n";
                    events.forEach(e => {
                        const eventDate = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                        answer += `• **${eventDate}**: ${e.event} (${e.type})\n`;
                    });
                } else {
                    answer = "There are no special events coming up in the next 14 days.";
                }
            }
            else if (question === "How to contact the school?") {
                const contactInfo = getSchoolContactInfo();
                answer = "Here is the contact information for the school leadership:\n\n";
                answer += `• **PP Coordinator**: [${contactInfo.coordinatorEmail}](mailto:${contactInfo.coordinatorEmail})\n`;
                answer += `• **Principal (${contactInfo.principalName || 'Dr. Malini Dutta'})**: [${contactInfo.principalEmail}](mailto:${contactInfo.principalEmail})\n`;
                answer += `• **School Email**: [${contactInfo.schoolEmail}](mailto:${contactInfo.schoolEmail})\n`;
                if (contactInfo.phone) answer += `• **Phone**: ${contactInfo.phone}\n`;
                if (contactInfo.website) answer += `• **Website**: [${contactInfo.website}](http://${contactInfo.website})\n\n`;
                else answer += "\n";
                answer += "Please feel free to reach out to them for any queries.";
            }
            else {
                answer = "I'm sorry, I can only answer the specific suggested questions right now.";
            }
        } catch (error) {
            console.error("Chat error:", error);
            answer = "Sorry, I ran into an error trying to fetch that information for you. Please try again later.";
        }

        const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: answer,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
    };

    const formatText = (text: string) => {
        // Basic markdown-like formatting for links, bold (**text**) and lists (•)
        const lines = text.split('\n');
        return lines.map((line, i) => {
            if (line.trim() === '') return <br key={i} />;

            let parts: React.ReactNode[] = [];
            let lastIndex = 0;

            // Simple parser that handles links first, then bold inside text portions
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let linkMatch;

            while ((linkMatch = linkRegex.exec(line)) !== null) {
                // Process text before the link for bold
                const preText = line.substring(lastIndex, linkMatch.index);
                parts.push(...processBold(preText, `${i}-pre-${linkMatch.index}`));

                // Add the link
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

            // Process remaining text after the last link
            if (lastIndex < line.length) {
                const postText = line.substring(lastIndex);
                parts.push(...processBold(postText, `${i}-post`));
            }

            return (
                <div key={i} className={line.startsWith('•') ? "ml-4" : "mt-1"}>
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
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-200 border border-orange-500"></span>
                </span>
            </button>

            {/* Chat Window */}
            <div
                className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] h-[80vh] sm:h-[580px] max-h-[calc(100vh-96px)] sm:max-h-[calc(100vh-48px)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 transform origin-bottom-right focus:outline-none overflow-hidden border border-gray-100
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
                    {/* Soft background blob */}
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
                                className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
                ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-br-sm'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                                    }`}
                                style={{ maxWidth: '85%' }}
                            >
                                {formatText(msg.text)}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
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
                <div className="p-3 bg-white border-t border-gray-100 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-10 relative">
                    <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider pl-1">Ask a question:</div>
                    <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar pb-1">
                        {modelQuestions.map((q, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleQuestionClick(q)}
                                disabled={isTyping}
                                className="text-left text-xs bg-slate-50 border border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700 px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
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
