import { useAuth } from '../contexts/AuthContext';

interface CanGenerateReturn {
    canGenerate: boolean;
    isLowBalance: boolean;
    tokensRemaining: number;
    postsRemaining: number;
}

export function useCanGenerate(): CanGenerateReturn {
    const { me } = useAuth();

    const tokensRemaining = (me?.usage?.tokens_limit ?? 0) - (me?.usage?.tokens_used ?? 0);
    const postsRemaining = (me?.usage?.posts_limit ?? 0) - (me?.usage?.posts_used ?? 0);

    // A user can generate if they have both tokens and posts available
    const canGenerate = tokensRemaining > 0 && postsRemaining > 0;

    // A user is considered low balance if they have tokens but are at or below the threshold
    const threshold = me?.config?.low_balance_threshold ?? 50;
    const isLowBalance = tokensRemaining > 0 && tokensRemaining <= threshold;

    return {
        canGenerate,
        isLowBalance,
        tokensRemaining,
        postsRemaining
    };
}
