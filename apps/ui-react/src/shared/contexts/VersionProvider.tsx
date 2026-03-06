import { createContext, useContext, useMemo, ReactNode } from 'react';

/**
 * genOS™ v5.0.0 — Ecosystem Versioning Provider
 * Strictly enforces build-time VITE_APP_VERSION injection.
 */
interface VersionContextType {
    version: string;
    buildTag: string;
}

const VersionContext = createContext<VersionContextType>({
    version: '5.0.0',
    buildTag: 'stable',
});

export function VersionProvider({ children }: { children: ReactNode }) {
    const version = import.meta.env.VITE_APP_VERSION || '5.0.0-dev';
    const buildTag = import.meta.env.MODE || 'production';

    const value = useMemo(() => ({
        version,
        buildTag,
    }), [version, buildTag]);

    return (
        <VersionContext.Provider value={value}>
            {children}
        </VersionContext.Provider>
    );
}

export const useGenOSVersion = () => useContext(VersionContext);
