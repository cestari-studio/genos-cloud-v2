import React, { useMemo } from 'react';
import {
    ProgressBar,
    Stack,
    Tile,
    Grid,
    Column,
    Tag
} from '@carbon/react';
import {
    Chip,
    DataTable,
    Activity,
    CloudUpload
} from '@carbon/icons-react';

interface UsageTelemetryProps {
    usage: {
        tokens_used: number;
        tokens_limit: number;
        posts_used: number;
        posts_limit: number;
    };
}

export default function UsageTelemetry({ usage }: UsageTelemetryProps) {
    const tokenPercent = useMemo(() =>
        Math.min(100, (usage.tokens_used / (usage.tokens_limit || 1)) * 100),
        [usage]);

    const postPercent = useMemo(() =>
        Math.min(100, (usage.posts_used / (usage.posts_limit || 1)) * 100),
        [usage]);

    const getTokenStatus = (percent: number) => {
        if (percent > 90) return 'error';
        if (percent > 70) return 'active';
        return 'finished';
    };

    return (
        <div className="usage-telemetry-container">
            <Grid fullWidth>
                <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                        <Stack gap={4}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Chip size={20} color="#f1c21b" />
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.5px' }}>TOKEN INTELLIGENCE</span>
                                </div>
                                <Tag type={getTokenStatus(tokenPercent) === 'error' ? 'red' : 'green'} size="sm">
                                    {(usage.tokens_limit || 0) - (usage.tokens_used || 0)} REMAINING
                                </Tag>
                            </div>

                            <ProgressBar
                                label="Semantic Compute Units"
                                helperText={`${(usage.tokens_used || 0).toLocaleString()} / ${(usage.tokens_limit || 0).toLocaleString()} TK`}
                                value={tokenPercent}
                                status={getTokenStatus(tokenPercent)}
                            />

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.25rem' }}>Current Session</p>
                                    <p style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>242 TK</p>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.25rem' }}>Processing Capacity</p>
                                    <p style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>99.2%</p>
                                </div>
                            </div>
                        </Stack>
                    </Tile>
                </Column>

                <Column lg={8} md={4} sm={4}>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                        <Stack gap={4}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CloudUpload size={20} color="#4589ff" />
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.5px' }}>CONTENT PRODUCTION</span>
                                </div>
                                <Tag type="blue" size="sm">ACTIVE CYCLE</Tag>
                            </div>

                            <ProgressBar
                                label="Industrial Output"
                                helperText={`${usage.posts_used || 0} / ${usage.posts_limit || 0} Posts Generated`}
                                value={postPercent}
                                status="active"
                            />

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.25rem' }}>Efficiency Rate</p>
                                    <p style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>84.5%</p>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.25rem' }}>Network Latency</p>
                                    <p style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>12ms</p>
                                </div>
                            </div>
                        </Stack>
                    </Tile>
                </Column>
            </Grid>

            <style>{`
        .usage-telemetry-container .cds--progress-bar__bar {
          height: 8px;
        }
        .usage-telemetry-container .cds--progress-bar__label {
          color: #f4f4f4;
          font-weight: 500;
        }
        .usage-telemetry-container .cds--tile {
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .usage-telemetry-container .cds--tile:hover {
          transform: translateY(-2px);
          border-color: #4589ff;
        }
      `}</style>
        </div>
    );
}
