import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface VersionInfo {
    version: string;
    date: string;
    title: string;
    notes: string;
}

interface VersionContextType {
    hasUpdate: boolean;
    latestVersion: VersionInfo | null;
    dismissUpdate: () => void;
    currentVersion: string | null;
}

const VersionContext = createContext<VersionContextType>({
    hasUpdate: false,
    latestVersion: null,
    dismissUpdate: () => { },
    currentVersion: null,
});

const STORAGE_KEY = 'genOS_version_acked';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function VersionProvider({ children }: { children: ReactNode }) {
    const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
    const [hasUpdate, setHasUpdate] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<string | null>(
        () => localStorage.getItem(STORAGE_KEY)
    );

    const checkVersion = useCallback(async () => {
        try {
            // Cache-bust with timestamp
            const res = await fetch(`/changelog.json?t=${Date.now()}`);
            if (!res.ok) return;
            const data: VersionInfo = await res.json();

            setLatestVersion(data);

            const acknowledged = localStorage.getItem(STORAGE_KEY);
            if (acknowledged !== data.version) {
                // Only show update if we already have a previous version stored
                // (i.e., not first visit)
                if (acknowledged !== null) {
                    setHasUpdate(true);
                } else {
                    // First visit — just store the version silently
                    localStorage.setItem(STORAGE_KEY, data.version);
                    setCurrentVersion(data.version);
                }
            }
        } catch {
            // Ignore network errors — version check is non-critical
        }
    }, []);

    const dismissUpdate = useCallback(() => {
        if (latestVersion) {
            localStorage.setItem(STORAGE_KEY, latestVersion.version);
            setCurrentVersion(latestVersion.version);
        }
        setHasUpdate(false);
    }, [latestVersion]);

    useEffect(() => {
        checkVersion();
        const interval = setInterval(checkVersion, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [checkVersion]);

    return (
        <VersionContext.Provider value={{ hasUpdate, latestVersion, dismissUpdate, currentVersion }}>
            {children}
        </VersionContext.Provider>
    );
}

export function useVersion() {
    return useContext(VersionContext);
}
