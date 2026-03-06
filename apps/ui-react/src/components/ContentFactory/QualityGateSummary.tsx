import React from 'react';
import {
    Stack,
    Grid,
    Column,
    ProgressBar,
} from '@carbon/react';
import {
    ChatBot,
    View,
    Locked,
    GroupAccount,
    SettingsAdjust,
    Idea,
} from '@carbon/icons-react';

interface QualityGateSummaryProps {
    scores: {
        brand_voice?: number;
        char_compliance?: number;
        editorial_coherence?: number;
        engagement_potential?: number;
        format_compliance?: number;
        originality?: number;
        weighted_total?: number;
        passed?: boolean;
    };
}

export default function QualityGateSummary({ scores }: QualityGateSummaryProps) {
    const metrics = [
        { label: 'Brand Voice', value: scores.brand_voice || 0, icon: ChatBot },
        { label: 'Compliance', value: scores.char_compliance || 0, icon: Locked },
        { label: 'Editorial', value: scores.editorial_coherence || 0, icon: SettingsAdjust },
        { label: 'Engagement', value: scores.engagement_potential || 0, icon: Idea },
        { label: 'Format', value: scores.format_compliance || 0, icon: View },
        { label: 'Originality', value: scores.originality || 0, icon: GroupAccount },
    ];

    return (
        <Stack gap={6} className="quality-gate-summary" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="cds--type-productive-heading-02">Helian™ Quality Gate Analysis</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="cds--type-label-01">Score Ponderado:</span>
                    <span className={`cds--type-productive-heading-03 ${scores.passed ? 'cds--text-success' : 'cds--text-error'}`}>
                        {scores.weighted_total?.toFixed(1) || '0.0'}/10
                    </span>
                </div>
            </div>

            <Grid condensed>
                {metrics.map((m) => (
                    <Column sm={2} md={4} lg={4} key={m.label}>
                        <Stack gap={2} style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <m.icon size={16} />
                                <span className="cds--type-label-01">{m.label}</span>
                            </div>
                            <ProgressBar
                                label={m.label}
                                hideLabel
                                value={m.value * 10}
                                max={100}
                                status={m.value >= 8 ? 'finished' : m.value >= 5 ? 'active' : 'error'}
                                size="small"
                            />
                            <span className="cds--type-caption-01">{m.value.toFixed(1)}/10</span>
                        </Stack>
                    </Column>
                ))}
            </Grid>
        </Stack>
    );
}
