import { Tag, Tile, Stack, AILabel, AILabelContent } from '@carbon/react';
import { Cost } from '@carbon/icons-react';

interface InlineEstimateProps {
    cost: number;
    balance: number;
    format?: string;
    loading?: boolean;
}

/**
 * InlineEstimate
 * Shows "~{cost} tokens · Saldo: {balance} → {balance-cost}"
 * Color coded based on affordability using Carbon tokens.
 */
export const InlineEstimate: React.FC<InlineEstimateProps> = ({ cost, balance, format, loading }) => {
    if (loading) return <Tag type="gray">Calculando custo...</Tag>;

    const affordable = balance >= cost;
    const afterBalance = balance - cost;

    return (
        <Tile className="inline-estimate">
            <Stack orientation="horizontal" gap={3} className="inline-estimate__row">
                <Cost size={18} className={affordable ? 'icon--success' : 'icon--error'} />
                <span className={affordable ? 'cds--type-label-01 token-balance--positive' : 'cds--type-label-01 token-balance--negative'}>
                    ~{cost} tokens
                </span>
                <span className="cds--type-label-01">·</span>
                <span className="cds--type-body-short-01">
                    Saldo: {balance} → <strong className={affordable ? 'token-balance--positive' : 'token-balance--negative'}>{afterBalance}</strong>
                </span>
                {format && (
                    <Tag size="sm" type="blue" className="inline-estimate__format-tag">{format}</Tag>
                )}
            </Stack>
        </Tile>
    );
};
