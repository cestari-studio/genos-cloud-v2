import React, { useState, useEffect } from 'react';
import {
    Grid,
    Column,
    Tile,
    Stack,
    ProgressBar,
    Tag,
    Button,
    Loading,
    ClickableTile,
    IconButton
} from '@carbon/react';
import {
    GaugeChart,
    BubbleChart
} from '@carbon/charts-react';
import { AILabel, AILabelContent, AILabelActions } from '@carbon/react';
import {
    Renew,
    Information,
    Help,
    Flash,
    ChartRadar as GeoIcon,
    Terminal as PulseIcon
} from '@carbon/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import { t } from '../../../../config/locale';
import '@carbon/charts-react/styles.css';

interface GeoIntelligenceProps {
    tenantId?: string;
}

export default function GeoIntelligence({ tenantId }: GeoIntelligenceProps) {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [avgResonance, setAvgResonance] = useState(0);
    const [quota, setQuota] = useState({ used: 0, limit: 600 }); // 600s = 10m

    const fetchGeoData = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const data = await api.getGeoAnalytics(tenantId);
            setAnalytics(data);

            // Calculate quota from telemetry
            const used = data.reduce((acc: number, curr: any) => acc + (curr.execution_telemetry?.seconds_consumed || 0), 0);
            setQuota(prev => ({ ...prev, used }));
        } catch (e) {
            console.error('[GEO] Fetch failed', e);
        } finally {
            setLoading(false);
        }
    };

    const calculateAvgResonance = async () => {
        if (!tenantId) return;
        const { data } = await supabase
            .from('matrix_assets')
            .select('qhe_score')
            .eq('tenant_id', tenantId)
            .not('qhe_score', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data && data.length > 0) {
            const sum = data.reduce((acc, curr) => acc + (curr.qhe_score || 0), 0);
            setAvgResonance(sum / data.length);
        }
    };

    useEffect(() => {
        fetchGeoData();
        calculateAvgResonance();

        if (!tenantId) return;

        const channel = supabase
            .channel('geo_telemetry_sync')
            .on('postgres_changes' as any, {
                event: '*',
                schema: 'public',
                table: 'matrix_assets',
                filter: `tenant_id=eq.${tenantId}`
            }, () => {
                calculateAvgResonance();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId]);

    const handlePulse = async () => {
        if (!tenantId || analytics.length === 0) return;
        setProcessing(true);
        try {
            // Pick latest or a specific one to re-scan
            const latest = analytics[0];
            await api.calculateQuantumResonance(tenantId, latest.id, []);
            await fetchGeoData();
        } catch (e) {
            console.error('[GEO] Pulse failed', e);
        } finally {
            setProcessing(false);
        }
    };

    if (loading && analytics.length === 0) {
        return (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loading withOverlay={false} />
            </div>
        );
    }

    const latest = analytics[0] || { qhe_score: 0, execution_telemetry: {} };

    const gaugeData = [
        { group: "Average Resonance", value: Number((avgResonance * 100).toFixed(1)) }
    ];

    const gaugeOptions = {
        title: t('geoIntelligence.gaugeTitle'),
        resizable: true,
        height: "250px",
        gauge: {
            type: "semi",
            status: latest.qhe_score > 80 ? "success" : latest.qhe_score > 50 ? "warning" : "danger"
        },
        theme: "g100"
    };

    const bubbleData = [
        { group: "Tech Trends", x: 20, y: 30, value: 15 },
        { group: "Competitor A", x: 45, y: 60, value: 25 },
        { group: "Market Gap", x: 70, y: 85, value: 40 },
        { group: "Brand DNA", x: 50, y: 50, value: 20 }
    ];

    const bubbleOptions = {
        title: t('geoIntelligence.bubbleTitle'),
        axes: {
            bottom: { title: t('geoIntelligence.axisMarket'), mapsTo: "x" },
            left: { title: t('geoIntelligence.axisStrategic'), mapsTo: "y" }
        },
        bubble: { radiusMapsTo: "value" },
        height: "300px",
        theme: "g100"
    };

    return (
        <Stack gap={6} className="geo-intelligence-dashboard" style={{ padding: '1rem', backgroundColor: '#161616' }}>
            {/* HDR STATUS BAR */}
            <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.13 }} // moderate-01: 130ms
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
                <div>
                    <h2 style={{ color: '#F4F4F4', fontSize: '1.5rem', fontWeight: 400, fontFamily: 'IBM Plex Sans' }}>
                        {t('geoIntelligence.title')}
                    </h2>
                    <p style={{ color: '#A8A8A8', fontSize: '0.875rem' }}>{t('geoIntelligence.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Tag type="purple" renderIcon={PulseIcon} style={{ fontFamily: 'IBM Plex Mono' }}>ibm_fez: ONLINE</Tag>
                    <Tag type="outline" size="sm">Coherence: 98.5%</Tag>
                    <IconButton label={t('common.settings')} kind="ghost" size="sm">
                        <Information size={16} />
                    </IconButton>
                </div>
            </motion.section>

            <Grid fullWidth narrow>
                {/* QHE SCORE GAUGE */}
                <Column lg={6} md={4} sm={4}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.13 }}
                    >
                        <Tile style={{ backgroundColor: '#262626', height: '100%', position: 'relative', border: '1px solid #393939' }}>
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
                                <AILabel size="sm">
                                    <AILabelContent>
                                        <div style={{ padding: '0.5rem' }}>
                                            <h5 style={{ marginBottom: '0.5rem' }}>{t('geoIntelligence.explainableTitle')}</h5>
                                            <p style={{ fontSize: '0.75rem', color: '#A8A8A8' }}>
                                                {t('geoIntelligence.explainableDesc')}
                                            </p>
                                        </div>
                                    </AILabelContent>
                                    <AILabelActions>
                                        <Button kind="ghost" size="sm">{t('geoIntelligence.viewTelemetry')}</Button>
                                    </AILabelActions>
                                </AILabel>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <Tag type="purple" size="sm">QHE™ Alpha</Tag>
                            </div>
                            <GaugeChart data={gaugeData} options={gaugeOptions} />
                            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#161616', borderRadius: '2px', border: '1px solid #393939' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Flash size={16} fill="#8A3FFC" />
                                    <span style={{ color: '#F4F4F4', fontSize: '0.75rem', fontWeight: 600 }}>{t('geoIntelligence.auraAnalysis')}</span>
                                </div>
                                <p style={{ color: '#A8A8A8', fontSize: '0.75rem', lineHeight: '1.2' }}>
                                    {t('geoIntelligence.auraAnalysisDesc')}
                                </p>
                            </div>
                        </Tile>
                    </motion.div>
                </Column>

                {/* BUBBLE CHART LANDSCAPE */}
                <Column lg={10} md={4} sm={4}>
                    <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.13, delay: 0.05 }}
                    >
                        <Tile style={{ backgroundColor: '#262626', height: '100%', border: '1px solid #393939' }}>
                            <BubbleChart data={bubbleData} options={bubbleOptions} />
                        </Tile>
                    </motion.div>
                </Column>

                {/* QUOTA & CONTROLS */}
                <Column lg={16} md={8} sm={4}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.13, delay: 0.1 }}
                    >
                        <Tile style={{ backgroundColor: '#262626', marginTop: '1rem', border: '1px solid #393939' }}>
                            <Grid fullWidth narrow>
                                <Column lg={10} md={5} sm={4}>
                                    <Stack gap={4}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#F4F4F4', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                                                <span style={{ fontFamily: 'IBM Plex Sans' }}>{t('geoIntelligence.quotaUsed')}</span>
                                                <span style={{ fontFamily: 'IBM Plex Mono' }}>{Math.round(quota.used / 60 * 100) / 100} / 10 {t('geoIntelligence.remainingTime')}</span>
                                            </div>
                                            <ProgressBar
                                                label=""
                                                value={quota.used}
                                                max={quota.limit}
                                                status={quota.used > 500 ? 'error' : 'active'}
                                            />
                                        </div>
                                        <p style={{ color: '#8D8D8D', fontSize: '0.75rem' }}>
                                            {t('geoIntelligence.quotaHelper')}
                                        </p>
                                    </Stack>
                                </Column>
                                <Column lg={6} md={3} sm={4} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                                    <Button kind="ghost" size="lg" renderIcon={Help}>{t('common.accessLogs')}</Button>
                                    <Button
                                        kind="primary"
                                        size="lg"
                                        renderIcon={Flash}
                                        onClick={handlePulse}
                                        disabled={processing || quota.used >= quota.limit}
                                    >
                                        {processing ? t('geoIntelligence.processing') || 'Processing...' : t('geoIntelligence.executePulse')}
                                    </Button>
                                </Column>
                            </Grid>
                        </Tile>
                    </motion.div>
                </Column>
            </Grid>

            {/* AILabel / Insights Section */}
            <Tile style={{ backgroundColor: '#262626', borderLeft: '4px solid #8A3FFC' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#8A3FFC', color: 'white', padding: '4px 8px', borderRadius: '2px', fontWeight: 600, fontSize: '0.65rem' }}>AI EXPLAINER</div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ color: '#F4F4F4', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{t('geoIntelligence.logicTitle')}</h4>
                        <p style={{ color: '#A8A8A8', fontSize: '0.875rem' }}>
                            {t('geoIntelligence.logicDesc')}
                        </p>
                    </div>
                </div>
            </Tile>

            <style>{`
                .geo-intelligence-dashboard .cds--progress-bar__bar {
                    background-color: #8A3FFC;
                }
                .geo-intelligence-dashboard .cds--progress-bar--danger .cds--progress-bar__bar {
                    background-color: #DA1E28;
                }
            `}</style>
        </Stack>
    );
}
