export type SocialPlatform = 'instagram' | 'facebook' | 'whatsapp';

export interface SocialConnection {
    id: string;
    tenant_id: string;
    platform: SocialPlatform;
    platform_user_id: string;
    platform_username: string;
    platform_profile_pic?: string;
    status: 'active' | 'expired' | 'revoked' | 'error';
    connected_at: string;
    token_expires_at?: string;
    scopes?: string[];
    fb_page_id?: string;
    ig_account_id?: string;
}

export interface PublishResult {
    platform: SocialPlatform;
    status: 'pending' | 'processing' | 'published' | 'failed';
    external_post_id?: string;
    error?: string;
}
