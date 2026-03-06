import React, { useEffect, useState } from 'react';
import { InlineNotification, SkeletonText, Stack, AILabel, AILabelContent } from '@carbon/react';
import { InlineEstimate } from './InlineEstimate';
import { api } from '@/services/api';
import { useAuth } from '@/shared/contexts/AuthContext';

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
                const rawResult = await api.edgeFn<any>('token-estimator', {
                    tenantId: me.tenant.id,
                    format,
                    operation,
                    slide_count: slideCount,
                    ai_model: aiModel
                });

                // api.edgeFn already unwraps { data: ... }, but the edge fn itself
                // wraps in { success, data } — handle both shapes gracefully
                const estimateData: EstimateResult =
                    rawResult?.estimated_cost !== undefined
                        ? rawResult
                        : (rawResult?.data ?? rawResult);

                if (active && estimateData?.estimated_cost !== undefined) {
                    setEstimate(estimateData);
                    onValidationChange?.(estimateData.can_afford);
                } else if (active) {
                    setError('Não foi possível calcular o custo. Verifique o token estimator.');
                    onValidationChange?.(false);
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
            <Stack gap={2}>
                <SkeletonText width="50%" />
                <SkeletonText width="30%" />
            </Stack>
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
            />
        );
    }

    return (
        <Stack gap={2}>
            <Stack orientation="horizontal" gap={2}>
                <span className="cds--type-label-01">Estimativa de custo</span>
                <AILabel autoAlign>
                    <AILabelContent>
                        <p>Cálculo: base_cost + per_slide × (slides-1) × model_multiplier. O fator de multiplicação varia por modelo: flash (1×), pro (2×), ultra (4×).</p>
                    </AILabelContent>
                </AILabel>
            </Stack>
            <InlineEstimate
                cost={estimate.estimated_cost}
                balance={estimate.current_balance}
                format={format}
            />
        </Stack>
    );
};
