import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface VersionUpdate {
    version: string;
    date: string;
    title: string;
    notes: string;
}

interface VersionContextType {
    currentVersion: string;
    remoteVersion: string | null;
    hasUpdate: boolean;
    updateData: VersionUpdate | null;
    dismissUpdate: () => void;
}

const VersionContext = createContext<VersionContextType>({
    currentVersion: '1.0.0',
    remoteVersion: null,
    hasUpdate: false,
    updateData: null,
    dismissUpdate: () => { },
});

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function VersionProvider({ children }: { children: ReactNode }) {
    // Grab the bundled version generated at build time
    const currentVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

    const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
    const [hasUpdate, setHasUpdate] = useState(false);
    const [updateData, setUpdateData] = useState<VersionUpdate | null>(null);

    const checkVersion = useCallback(async () => {
        try {
            // Cache bust the fetch to ensure we get the latest build metadata
            const response = await fetch(`/version.json?t=${new Date().getTime()}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.version && data.version !== currentVersion) {
                setRemoteVersion(data.version);
                setHasUpdate(true);

                // Fetch changelog notes if an update is available
                try {
                    const changelogRes = await fetch(`/changelog.json?t=${new Date().getTime()}`);
                    if (changelogRes.ok) {
                        const changelogData = await changelogRes.json();
                        const latestUpdate = changelogData.updates?.find((u: any) => u.version === data.version);
                        if (latestUpdate) {
                            setUpdateData(latestUpdate);
                        }
                    }
                } catch (err) {
                    console.error('Failed to load changelog.json', err);
                }
            }
        } catch (err) {
            console.error('Failed to check version.json', err);
        }
    }, [currentVersion]);

    useEffect(() => {
        checkVersion(); // Check immediately
        const interval = setInterval(checkVersion, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [checkVersion]);

    const dismissUpdate = useCallback(() => {
        setHasUpdate(false);
    }, []);

    return (
        <VersionContext.Provider value={{ currentVersion, remoteVersion, hasUpdate, updateData, dismissUpdate }}>
            {children}
        </VersionContext.Provider>
    );
}

export function useVersion() {
    return useContext(VersionContext);
}
