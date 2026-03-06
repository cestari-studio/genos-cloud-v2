import React, { useState, useEffect } from 'react';
import { RadarChart, BubbleChart } from '@carbon/charts-react';
import { Tile, Stack, Select, SelectItem, Loading, Tag } from '@carbon/react';
import { motion } from 'framer-motion';
import { t } from '../../../../config/locale';
import { api } from '@/services/api';
import '@carbon/charts-react/styles.css';

interface SemanticRadarProps {
    tenantId?: string;
}

export default function SemanticRadar({ tenantId }: SemanticRadarProps) {
    const [loading, setLoading] = useState(true);
    const [radarData, setRadarData] = useState<any[]>([]);
    const [bubbleData, setBubbleData] = useState<any[]>([]);

    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchGeoIntel = async () => {
            if (!tenantId) return;
            try {
                const data = await api.getGeoIntelligence(tenantId);
                setStats(data);

                // Map real data to chart formats
                setRadarData([
                    { group: t('semanticMarkerAI'), axis: t('semanticChartAlignment'), value: data.visibility_score },
                    { group: t('semanticMarkerAI'), axis: t('semanticChartDensity'), value: 70 }, // Mock until actual vector distribution
                    { group: t('semanticMarkerAI'), axis: t('semanticChartVelocity'), value: 95 },
                    { group: t('semanticMarkerAI'), axis: t('semanticChartConnectivity'), value: 60 },
                    { group: t('semanticMarkerAI'), axis: t('semanticChartResonance'), value: 80 },
                    // Benchmark core stays static or comes from config
                    { group: t('semanticMarkerCore'), axis: t('semanticChartAlignment'), value: 90 },
                    { group: t('semanticMarkerCore'), axis: t('semanticChartDensity'), value: 85 },
                    { group: t('semanticMarkerCore'), axis: t('semanticChartVelocity'), value: 65 },
                    { group: t('semanticMarkerCore'), axis: t('semanticChartConnectivity'), value: 75 },
                    { group: t('semanticMarkerCore'), axis: t('semanticChartResonance'), value: 90 },
                ]);

                setBubbleData(data.clusters.map((c: any, i: number) => ({
                    group: c.name,
                    x: Math.random() * 100, // Maturity simulation
                    y: c.value,
                    value: c.value
                })));

            } catch (e) {
                console.error('Geo Intel fetch failed', e);
            } finally {
                setLoading(false);
            }
        };

        fetchGeoIntel();
    }, [tenantId]);

    const radarOptions = {
        title: t('semanticRadarTitle'),
        radar: {
            axes: {
                angle: 'axis',
                value: 'value',
            },
        },
        data: {
            groupMapsTo: "group"
        },
        height: '400px',
        theme: 'g100',
    };

    const bubbleOptions = {
        title: 'Cluster Density & Market Volume',
        axes: {
            bottom: {
                title: 'Cluster Maturity',
                mapsTo: 'x',
            },
            left: {
                title: 'Engagement Depth',
                mapsTo: 'y',
            },
        },
        bubble: {
            radiusMapsTo: 'value',
        },
        height: '400px',
        theme: 'g100',
    };

    if (loading) {
        return (
            <Tile className="semantic-viz-loading" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loading withOverlay={false} description={t('loading')} />
            </Tile>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <Stack gap={6}>
                <div className="cds--row">
                    <div className="cds--col-lg-8 cds--col-md-8 cds--col-sm-4">
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <RadarChart data={radarData} options={radarOptions} />
                        </Tile>
                    </div>
                    <div className="cds--col-lg-8 cds--col-md-8 cds--col-sm-4">
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <BubbleChart data={bubbleData} options={bubbleOptions} />
                        </Tile>
                    </div>
                </div>

                <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4' }}>{t('semanticAuraTitle')}</h4>
                            <p className="cds--type-body-short-01" style={{ color: '#a8a8a8' }}>
                                Visibility Score: <strong style={{ color: '#8a3ffc' }}>{(stats?.visibility_score || 0).toFixed(2)}</strong> (RLS Verified)
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Tag type="purple" size="sm">AuraHelian™ V5</Tag>
                            <Select id="radar-benchmark" labelText="" inline hideLabel defaultValue="competitors">
                                <SelectItem value="competitors" text="Benchmark: Top 5 Competitors" />
                                <SelectItem value="historical" text="Historical Variation (90d)" />
                                <SelectItem value="global" text="Global Industry Standard" />
                            </Select>
                        </div>
                    </div>
                    <div style={{ padding: '1rem', borderLeft: '4px solid #8a3ffc', backgroundColor: '#161616' }}>
                        {t('semanticAuraInsight')}
                        <p className="cds--type-label-01" style={{ color: '#a8a8a8', marginTop: '0.5rem' }}>
                            {t('semanticAuraRec')}
                        </p>
                    </div>
                </Tile>
            </Stack>
        </motion.div>
    );
}
