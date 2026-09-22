'use client';

interface WeekendRevisionContent {
    weekCovered: string;
    subjects: {
        [key: string]: string[];
    };
}

interface WeekendRevisionProps {
    content: WeekendRevisionContent;
    date: string;
}

// Subject color mapping
const subjectColors: { [key: string]: { border: string; text: string; bullet: string } } = {
    'Literacy': { border: 'border-blue-200', text: 'text-blue-700', bullet: 'text-blue-500' },
    'Numeracy': { border: 'border-green-200', text: 'text-green-700', bullet: 'text-green-500' },
    'General Awareness': { border: 'border-orange-200', text: 'text-orange-700', bullet: 'text-orange-500' },
    'Kannada': { border: 'border-red-200', text: 'text-red-700', bullet: 'text-red-500' },
    'Hindi': { border: 'border-pink-200', text: 'text-pink-700', bullet: 'text-pink-500' },
    'Art': { border: 'border-purple-200', text: 'text-purple-700', bullet: 'text-purple-500' },
    'Story': { border: 'border-indigo-200', text: 'text-indigo-700', bullet: 'text-indigo-500' },
    'Socio Emotional Skills': { border: 'border-teal-200', text: 'text-teal-700', bullet: 'text-teal-500' },
};

// Subject icon mapping
const subjectIcons: { [key: string]: string } = {
    'Literacy': '📖',
    'Numeracy': '🔢',
    'General Awareness': '🌍',
    'Kannada': '🔤',
    'Hindi': '✍️',
    'Art': '🎨',
    'Story': '📚',
    'Socio Emotional Skills': '💭',
};

export default function WeekendRevision({ content, date }: WeekendRevisionProps) {
    // Get default colors for subjects not in the mapping
    const getSubjectStyle = (subject: string) => {
        return subjectColors[subject] || { border: 'border-gray-200', text: 'text-gray-700', bullet: 'text-gray-500' };
    };

    const getSubjectIcon = (subject: string) => {
        return subjectIcons[subject] || '📝';
    };

    return (
        <div className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 rounded-2xl border border-purple-100 p-4 sm:p-5 shadow-sm">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3 border-b border-purple-100 pb-3">
                <div className="text-2xl bg-white p-2 rounded-xl shadow-sm">📚</div>
                <div>
                    <h2 className="text-base font-bold text-gray-800">Weekly Summary</h2>
                    <p className="text-[10px] text-purple-500 font-bold uppercase tracking-tight">Week: {content.weekCovered}</p>
                </div>
            </div>

            {/* Revision Sections - Dynamic Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(content.subjects).map(([subject, topics]) => {
                    if (topics.length === 0) return null;

                    const style = getSubjectStyle(subject);
                    const icon = getSubjectIcon(subject);

                    return (
                        <div key={subject} className={`bg-white/60 backdrop-blur-sm rounded-xl p-3 border ${style.border} hover:shadow-sm transition-shadow`}>
                            <h3 className={`font-bold text-[11px] ${style.text} mb-2 flex items-center gap-1.5 uppercase tracking-wide`}>
                                <span className="text-sm">{icon}</span>
                                <span>{subject}</span>
                            </h3>
                            <ul className="space-y-1">
                                {topics.map((topic, index) => (
                                    <li key={index} className="text-xs text-gray-600 flex items-start gap-1.5 leading-snug">
                                        <span className={`${style.bullet} mt-1 text-[8px]`}>●</span>
                                        <span>{topic}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            {/* Footer Message */}
            <div className="mt-4 text-center">
                <p className="text-[10px] text-purple-400 font-medium">
                    💡 Tip: Practice these together for better understanding!
                </p>
            </div>
        </div>
    );
}
