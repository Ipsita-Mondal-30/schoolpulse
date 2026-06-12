'use client';

import React, { useState, useEffect } from 'react';

export default function MorningAlarm() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [time, setTime] = useState('07:00');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedEnabled = localStorage.getItem('morning_alarm_enabled') === 'true';
            const savedTime = localStorage.getItem('morning_alarm_time') || '07:00';
            setIsEnabled(savedEnabled);
            setTime(savedTime);
        }
    }, []);

    // Set up standard PWA mock push notification trigger
    const triggerLocalNotification = () => {
        if (!("Notification" in window)) {
            setStatusMessage("⚠️ Notifications not supported on this browser.");
            return;
        }

        if (Notification.permission === "granted") {
            showNotification();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showNotification();
                } else {
                    setStatusMessage("⚠️ Notification permission denied.");
                }
            });
        } else {
            setStatusMessage("⚠️ Enable notifications in your browser settings.");
        }
    };

    const showNotification = () => {
        const title = "☀️ Good morning! SchoolPulse Prep Alert";
        const options = {
            body: "Today: Pack EVS Book, wear regular school uniform. School bus scheduled at 8:15 AM.",
            icon: "/icons/icon-192.png",
            vibrate: [200, 100, 200],
            badge: "/icons/icon-192.png",
            tag: "morning-prep-alarm"
        };
        
        try {
            // Check for service worker registration first
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, options);
                });
            } else {
                new Notification(title, options);
            }
            setStatusMessage("🔔 Test alarm notification sent!");
            setTimeout(() => setStatusMessage(""), 4000);
        } catch (e) {
            new Notification(title, options);
        }
    };

    const handleToggle = () => {
        const nextState = !isEnabled;
        setIsEnabled(nextState);
        localStorage.setItem('morning_alarm_enabled', String(nextState));

        if (nextState) {
            // Request permissions immediately
            if ("Notification" in window && Notification.permission !== "granted") {
                Notification.requestPermission();
            }
            setStatusMessage(`⏰ Daily morning digest scheduled at ${time}`);
            setTimeout(() => setStatusMessage(""), 4000);
        } else {
            setStatusMessage('🛑 Morning digest disabled.');
            setTimeout(() => setStatusMessage(""), 4000);
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextTime = e.target.value;
        setTime(nextTime);
        localStorage.setItem('morning_alarm_time', nextTime);
        if (isEnabled) {
            setStatusMessage(`⏰ Alarm time updated to ${nextTime}`);
            setTimeout(() => setStatusMessage(""), 3000);
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm mb-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                <span className="text-8xl">⏰</span>
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            PWA Alarm
                        </span>
                        <h2 className="text-lg font-bold text-gray-800 mt-2 flex items-center gap-1.5">
                            <span>⏰</span> Smart Morning Prep Digest
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed max-w-md">
                            Wake up to tomorrow's bag packing guide, uniform color of the day, and bus tracker status sent automatically.
                        </p>
                    </div>

                    <button
                        onClick={handleToggle}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                            isEnabled ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                    >
                        <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                                isEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {isEnabled && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600">Alarm Time:</label>
                            <input
                                type="time"
                                value={time}
                                onChange={handleTimeChange}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300"
                            />
                        </div>
                        <button
                            onClick={triggerLocalNotification}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-orange-100 transition-colors ml-auto"
                        >
                            🔔 Test Notification
                        </button>
                    </div>
                )}

                {statusMessage && (
                    <div className="mt-3 text-[11px] font-semibold text-orange-600 animate-pulse">
                        {statusMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
