'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { fetchExternalUpdates } from '@/app/actions';
import { Announcement } from '@/lib/data';

interface UpdatesContextType {
    updates: Announcement[];
    homeworkCount: number;
    loading: boolean;
    refreshUpdates: () => Promise<void>;
}

const UpdatesContext = createContext<UpdatesContextType | undefined>(undefined);

export function UpdatesProvider({ children }: { children: ReactNode }) {
    const [updates, setUpdates] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    // This function fetches the updates from the server action
    // The server action itself handles the revalidation/caching strategy (e.g. 5-10 mins)
    const loadUpdates = useCallback(async () => {
        try {
            const data = await fetchExternalUpdates();
            // Only update state if data actually changed to verify fewer re-renders
            setUpdates(data);
        } catch (error) {
            console.error('Context: Failed to load updates', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        loadUpdates();

        // Auto-refresh every 5 minutes
        const intervalId = setInterval(() => {
            loadUpdates();
        }, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [loadUpdates]);

    const homeworkCount = useMemo(() => {
        return updates.filter(u =>
            u.category?.toLowerCase().includes('homework') ||
            u.type === 'homework'
        ).length;
    }, [updates]);

    const value = useMemo(() => ({
        updates,
        homeworkCount,
        loading,
        refreshUpdates: loadUpdates
    }), [updates, homeworkCount, loading, loadUpdates]);

    return (
        <UpdatesContext.Provider value={value}>
            {children}
        </UpdatesContext.Provider>
    );
}

export function useUpdates() {
    const context = useContext(UpdatesContext);
    if (context === undefined) {
        throw new Error('useUpdates must be used within an UpdatesProvider');
    }
    return context;
}
