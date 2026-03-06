export const PLATFORM_ROUTES = {
    HOME: '/',
    CONSOLE: '/console',
    WORKSTATION: '/workstation',
    FACTORY: {
        ROOT: '/content-factory',
        POSTS: '/content-factory/posts',
        SCHEDULE: '/content-factory/schedule',
        AUDIT: '/content-factory/audit',
        BRAND_DNA: '/content-factory/brand-dna',
        SEMANTIC: '/content-factory/brand-dna/semantic',
        QUALITY_GATE: '/content-factory/quality-gate',
        ANALYTICS: '/content-factory/analytics',
        PLANS: '/content-factory/plans',
        OBSERVATORY: '/content-factory/observatory',
        SETTINGS: '/content-factory/settings',
    },
    AGENCY: {
        PORTFOLIO: '/agency-portfolio',
    },
    CLIENT: {
        HOME: '/client/home',
        TEAM: '/client/team',
        BILLING: '/client/billing',
    },
    MASTER_ADMIN: '/master-admin',
    ONBOARDING: '/onboarding',
    SOCIAL_HUB: '/social-hub',
};

export const MARKETING_ROUTES = {
    HOME: '/home',
    PRICING: '/pricing',
    MARKETING: '/marketing',
};

export const AUTH_ROUTES = {
    LOGIN: '/login',
    FORGOT: '/auth/forgot',
    RESET: '/reset-password',
    WIX_CALLBACK: '/auth/wix/callback',
    SOCIAL_CALLBACK: '/auth/callback/meta',
};
