'use client';

import React from 'react';
import {
    Section, Tile, Grid, Column, Stack,
    StructuredListWrapper, StructuredListHead, StructuredListBody,
    StructuredListRow, StructuredListCell,
    Dropdown, Button, Tag
} from '@carbon/react';
import { RadarChart } from '@carbon/charts-react';
import { Network_4, DataEnrichment, CharacterPatterns } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { t } from '../components/LocaleSelectorModal';
import '@carbon/charts/styles.css';

// Mock Data for the Brand Authority Radar Chart
const radarData = [
    { product: 'Cestari Studio', feature: 'Inovação (Tech)', score: 95 },
    { product: 'Cestari Studio', feature: 'Performance (ROI)', score: 88 },
    { product: 'Cestari Studio', feature: 'Autoridade Estética', score: 98 },
    { product: 'Cestari Studio', feature: 'Atendimento', score: 90 },
    { product: 'Cestari Studio', feature: 'Scale Ecosystem', score: 92 },

    { product: 'Benchmark A (Concorrente)', feature: 'Inovação (Tech)', score: 60 },
    { product: 'Benchmark A (Concorrente)', feature: 'Performance (ROI)', score: 75 },
    { product: 'Benchmark A (Concorrente)', feature: 'Autoridade Estética', score: 85 },
    { product: 'Benchmark A (Concorrente)', feature: 'Atendimento', score: 70 },
    { product: 'Benchmark A (Concorrente)', feature: 'Scale Ecosystem', score: 50 },
];

const radarOptions = {
    title: 'Topologia Semântica: Share of Voice (SOV)',
    radar: {
        axes: {
            angle: 'feature',
            value: 'score'
        },
        alignment: 'center'
    },
    data: {
        groupMapsTo: 'product'
    },
    height: '450px',
    color: {
        scale: {
            'Cestari Studio': '#0f62fe', // Blue 60
            'Benchmark A (Concorrente)': '#fa4d56' // Red 50
        }
    },
    theme: 'g100'
};

const keywordClusters = [
    { cluster: 'genOS / Agentic', volume: '14.5k', density: 'Alta', trend: 'Subindo' },
    { cluster: 'Growth Hacking', volume: '8.2k', density: 'Média', trend: 'Estável' },
    { cluster: 'Carbon Design', volume: '5.1k', density: 'Alta', trend: 'Subindo' },
    { cluster: 'Tráfego Pago', volume: '22k', density: 'Baixa (Saturado)', trend: 'Descendo' },
];

export default function SemanticMapPage() {
    return (
        <PageLayout
            pageName="genOS"
            pageDescription={t('semanticMapSubtitle')}
            helpMode
        >
            <Section>
                <Grid>
                    <Column lg={8} md={8} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <Stack gap={2}>
                                    <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Network_4 fill="#8a3ffc" size={24} /> {t('semanticMapRadarTitle')}
                                    </h4>
                                    <p className="cds--type-label-01" style={{ color: '#c6c6c6' }}>
                                        {t('semanticMapRadarDesc')}
                                    </p>
                                </Stack>
                                <div style={{ width: '200px' }}>
                                    <Dropdown
                                        id="benchmark-select"
                                        titleText={t('semanticMapBenchmark')}
                                        label={t('semanticMapSelectBenchmark')}
                                        items={['Concorrente Principal', 'Média do Mercado', 'Aspiracional']}
                                        selectedItem="Concorrente Principal"
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem' }}>
                                {/* @ts-ignore : Component type overlay */}
                                <RadarChart data={radarData} options={radarOptions} />
                            </div>
                        </Tile>
                    </Column>

                    <Column lg={4} md={4} sm={4}>
                        <Stack gap={5} style={{ height: '100%' }}>
                            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                                <Stack gap={4}>
                                    <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem' }}>
                                        <DataEnrichment fill="#0f62fe" size={20} />
                                        {t('semanticMapClusters')}
                                    </h5>
                                    <StructuredListWrapper>
                                        <StructuredListHead>
                                            <StructuredListRow head>
                                                <StructuredListCell head>{t('semanticMapTopicCluster')}</StructuredListCell>
                                                <StructuredListCell head>{t('semanticMapVolume')}</StructuredListCell>
                                                <StructuredListCell head>{t('semanticMapDensity')}</StructuredListCell>
                                            </StructuredListRow>
                                        </StructuredListHead>
                                        <StructuredListBody>
                                            {keywordClusters.map((row, i) => (
                                                <StructuredListRow key={i}>
                                                    <StructuredListCell>{row.cluster}</StructuredListCell>
                                                    <StructuredListCell>{row.volume}</StructuredListCell>
                                                    <StructuredListCell>
                                                        <Tag type={row.trend === 'Subindo' ? 'green' : row.trend === 'Descendo' ? 'red' : 'blue'}>
                                                            {row.density}
                                                        </Tag>
                                                    </StructuredListCell>
                                                </StructuredListRow>
                                            ))}
                                        </StructuredListBody>
                                    </StructuredListWrapper>
                                </Stack>
                            </Tile>

                            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', flexGrow: 1 }}>
                                <Stack gap={4}>
                                    <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem' }}>
                                        <CharacterPatterns fill="#fa4d56" size={20} />
                                        {t('semanticMapQuantumAgent')}
                                    </h5>
                                    <p className="cds--type-body-short-01" style={{ color: '#c6c6c6' }}>
                                        {t('semanticMapWhiteSpace')} <strong>"genOS / Agentic"</strong>.
                                        {t('semanticMapRecommendation')}
                                    </p>
                                    <Button size="sm" kind="tertiary" style={{ width: '100%' }}>
                                        {t('semanticMapExtractGuidelines')}
                                    </Button>
                                </Stack>
                            </Tile>
                        </Stack>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
