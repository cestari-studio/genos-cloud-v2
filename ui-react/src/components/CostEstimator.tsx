import React, { useEffect, useState } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { InlineEstimate } from './InlineEstimate';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CostEstimatorProps {
    format: string;
    operation: string;
    slideCount?: number;
    aiModel?: string;
    onValidationChange?: (canAfford: boolean) => void;
}

interface EstimateResult {
    estimated_cost: number;
    current_balance: number;
    after_balance: number;
    can_afford: boolean;
    breakdown: {
        base_cost: number;
        slide_cost: number;
        model_multiplier: number;
        total: number;
    };
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({
    format,
    operation,
    slideCount = 1,
    aiModel = 'gemini-2.0-flash',
    onValidationChange
}) => {
    const { me } = useAuth();
    const [loading, setLoading] = useState(false);
    const [estimate, setEstimate] = useState<EstimateResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function fetchEstimate() {
            if (!me?.tenant) return;

            setLoading(true);
            setError(null);

            try {
                const result = await api.edgeFn<{ success: boolean; data: EstimateResult }>('token-estimator', {
                    tenantId: me.tenant.id,
                    format,
                    operation,
                    slide_count: slideCount,
                    ai_model: aiModel
                });

                if (active && result.success) {
                    setEstimate(result.data);
                    onValidationChange?.(result.data.can_afford);
                }
            } catch (err: any) {
                if (active) {
                    setError(err.message || 'Erro ao calcular custo');
                    onValidationChange?.(false);
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        // Debounce slightly to avoid spamming if slideCount changes rapidly
        const timeout = setTimeout(fetchEstimate, 400);
        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [me?.tenant, format, operation, slideCount, aiModel, onValidationChange]);

    if (loading) {
        return (
            <div className="mb-4">
                <SkeletonText width="50%" />
                <SkeletonText width="30%" />
            </div>
        );
    }

    if (error) {
        return (
            <InlineNotification
                kind="error"
                title="Erro de Faturamento"
                subtitle={error}
                lowContrast
                hideCloseButton
                className="mb-4 w-full"
            />
        );
    }

    if (!estimate) return null;

    if (!estimate.can_afford) {
        return (
            <InlineNotification
                kind="error"
                title="Saldo Insuficiente"
                subtitle={`Esta operação custará ~${estimate.estimated_cost} tokens, mas você possui apenas ${estimate.current_balance}.`}
                lowContrast
                hideCloseButton
                className="mb-4 w-full"
            />
        );
    }

    return (
        <div className="mb-4">
            <InlineEstimate
                cost={estimate.estimated_cost}
                balance={estimate.current_balance}
                format={format}
            />
        </div>
    );
};
