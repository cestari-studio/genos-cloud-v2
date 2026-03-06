/**
 * genOS™ v5.0.0 — Monitoring & Telemetry Configuration
 * Centralized telemetry management for production environments.
 */

export const monitoringConfig = {
    langfuse: {
        publicKey: import.meta.env.VITE_LANGFUSE_PUBLIC_KEY || '',
        baseUrl: import.meta.env.VITE_LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        enabled: !!import.meta.env.VITE_LANGFUSE_PUBLIC_KEY
    },
    telemetry: {
        debugMode: import.meta.env.MODE === 'development',
        sampleRate: 1.0, // 100% in production audit phase
    },
    errorReporting: {
        logToSupabase: true,
        logToConsole: import.meta.env.MODE === 'development'
    }
};
