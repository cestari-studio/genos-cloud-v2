import { Tag, Tile, Stack } from '@carbon/react';
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
 * Color coded based on affordability.
 */
export const InlineEstimate: React.FC<InlineEstimateProps> = ({ cost, balance, format, loading }) => {
    if (loading) return <Tag type="gray">Calculando custo...</Tag>;

    const affordable = balance >= cost;
    const afterBalance = balance - cost;

    return (
        <Tile className="inline-estimate" style={{
            padding: '0.75rem',
            backgroundColor: '#262626',
            border: `1px solid ${affordable ? '#24a148' : '#da1e28'}`,
            minHeight: 'auto'
        }}>
            <Stack orientation="horizontal" gap={3} style={{ alignItems: 'center' }}>
                <Cost size={18} fill={affordable ? '#42be65' : '#ff8389'} />
                <span style={{ color: affordable ? '#42be65' : '#ff8389', fontWeight: 600 }}>
                    ~{cost} tokens
                </span>
                <span style={{ color: '#c6c6c6' }}>·</span>
                <span style={{ color: '#f4f4f4', fontSize: '0.875rem' }}>
                    Saldo: {balance} → <strong style={{ color: affordable ? '#42be65' : '#ff8389' }}>{afterBalance}</strong>
                </span>
                {format && (
                    <Tag size="sm" type="blue" style={{ marginLeft: 'auto' }}>{format}</Tag>
                )}
            </Stack>
        </Tile>
    );
};
