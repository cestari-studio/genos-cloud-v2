import React, { createContext, useContext, useMemo } from 'react';
import { Theme } from '@carbon/react';

interface ThemeContextType {
    currentTheme: 'g100' | 'g90' | 'g10' | 'white';
    isWhiteLabel: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    currentTheme: 'g100',
    isWhiteLabel: false,
});

export const useGenOSTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
    children: React.ReactNode;
    theme?: 'g100' | 'g90' | 'g10' | 'white';
    whiteLabel?: boolean;
}

/**
 * genOS™ v5.0.0 — Industrial Theme Provider
 * Enforces GS100 (#161616) with support for white-label overrides.
 */
export function GenOSThemeProvider({
    children,
    theme = 'g100',
    whiteLabel = false
}: ThemeProviderProps) {

    // Inject CSS standard-easing and 2x grid tokens if needed via global styles
    const value = useMemo(() => ({
        currentTheme: theme,
        isWhiteLabel: whiteLabel
    }), [theme, whiteLabel]);

    return (
        <ThemeContext.Provider value={value}>
            <Theme theme={theme}>
                <div
                    className={`genos-theme-wrapper ${whiteLabel ? 'genos-white-label' : ''}`}
                    style={{
                        backgroundColor: theme === 'g100' ? 'var(--cds-background)' : undefined,
                        minHeight: '100vh',
                        colorScheme: theme === 'g100' || theme === 'g90' ? 'dark' : 'light',
                        // genOS Industrial UI Tokens
                        ['--cds-standard-easing' as any]: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
                        ['--genos-productive-duration' as any]: '130ms',
                        ['--genos-grid-2x' as any]: '32px'
                    }}
                >
                    {children}
                </div>
            </Theme>
        </ThemeContext.Provider>
    );
}
