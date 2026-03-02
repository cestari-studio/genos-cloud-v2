'use client';

import React from 'react';
import {
    Section, Tile, Grid, Column, Stack, Tag, Button
} from '@carbon/react';
import { AreaChart, MeterChart, GaugeChart, LineChart } from '@carbon/charts-react';
import { SatelliteRadar, Activity, WatsonHealthAiStatus, IbmCloud, MachineLearningModel } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import '@carbon/charts/styles.css';

// Mock Data for Area Chart (Drift vs Prediction)
const predictionData = [
    { group: 'Previsão Teórica (Bounds)', date: '2026-02-20T10:00:00.000Z', value: 10 },
    { group: 'Previsão Teórica (Bounds)', date: '2026-02-21T10:00:00.000Z', value: 11 },
    { group: 'Previsão Teórica (Bounds)', date: '2026-02-22T10:00:00.000Z', value: 12 },
    { group: 'Previsão Teórica (Bounds)', date: '2026-02-23T10:00:00.000Z', value: 11 },
    { group: 'Previsão Teórica (Bounds)', date: '2026-02-24T10:00:00.000Z', value: 10 },
    { group: 'Desvio Real do Agente (Drift)', date: '2026-02-20T10:00:00.000Z', value: 8 },
    { group: 'Desvio Real do Agente (Drift)', date: '2026-02-21T10:00:00.000Z', value: 13 },
    { group: 'Desvio Real do Agente (Drift)', date: '2026-02-22T10:00:00.000Z', value: 25 },
    { group: 'Desvio Real do Agente (Drift)', date: '2026-02-23T10:00:00.000Z', value: 45 },
    { group: 'Desvio Real do Agente (Drift)', date: '2026-02-24T10:00:00.000Z', value: 65 },
];

const areaOptions = {
    title: 'Análise Preditiva de Drift Cognitivo (IBM Granite)',
    axes: {
        bottom: {
            title: 'Timeline de Orquestração',
            mapsTo: 'date',
            scaleType: 'time'
        },
        left: {
            mapsTo: 'value',
            title: 'Drift Score (%)',
            scaleType: 'linear'
        }
    },
    curve: 'curveMonotoneX',
    height: '400px',
    color: {
        scale: {
            'Previsão Teórica (Bounds)': '#8a3ffc',
            'Desvio Real do Agente (Drift)': '#fa4d56'
        }
    },
    theme: 'g100'
};

const meterData = [
    { group: 'Uso de RAM', value: 85 }
];

const meterOptions = {
    title: 'K8s Cluster Alpha (RAM)',
    meter: {
        peak: 90,
        status: {
            ranges: [
                { range: [0, 60], status: 'success' },
                { range: [60, 80], status: 'warning' },
                { range: [80, 100], status: 'danger' }
            ]
        }
    },
    height: '150px',
    color: { scale: { 'Uso de RAM': '#0f62fe' } },
    theme: 'g100'
};

const gaugeData = [
    { group: 'Latência IBM Quantum', value: 102 }
];

const gaugeOptions = {
    title: 'Qiskit Job Execution Latency',
    resizable: true,
    height: '250px',
    gauge: {
        type: 'semi',
        status: 'warning',
        valueFontSize: 'h2'
    },
    color: { scale: { 'Latência IBM Quantum': '#f1c21b' } },
    theme: 'g100'
};

export default function QuantumObservabilityPage() {
    return (
        <PageLayout
            title="Cestari Studio Quantum | Observabilidade e Telemetria IA"
            subtitle="Painel Avançado para Detecção de Drift e Telemetria de Tensores IA."
            helpMode={true}
        >
            <Section>
                <Grid>
                    {/* Linha Superior: Info Cards Rápidos */}
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <Stack gap={3}>
                                <SatelliteRadar size={24} fill="#fa4d56" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Anomalias de Drift Activas</h4>
                                <h2 className="cds--type-productive-heading-05">12 Alertas</h2>
                                <Button kind="ghost" size="sm">Recalibrar Modelos</Button>
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <Stack gap={3}>
                                <WatsonHealthAiStatus size={24} fill="#0f62fe" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Integridade IBM Granite</h4>
                                <h2 className="cds--type-productive-heading-05">Online (99.9%)</h2>
                                <Tag type="green" style={{ width: 'fit-content' }}>Healthy</Tag>
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={8} md={8} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <Stack gap={3} orientation="horizontal" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                    <MachineLearningModel size={24} fill="#8a3ffc" />
                                    <h4 className="cds--type-label-01" style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>Constraint Kernel Pipeline</h4>
                                    <h2 className="cds--type-productive-heading-04" style={{ marginTop: '0.5rem' }}>2.4M Tokens Processados</h2>
                                </div>
                                <div style={{ width: '250px' }}>
                                    {/* @ts-ignore : Chart Type Error in Carbon Types sometimes */}
                                    <MeterChart data={meterData} options={meterOptions} />
                                </div>
                            </Stack>
                        </Tile>
                    </Column>
                </Grid>

                <Grid style={{ marginTop: '1.5rem' }}>
                    <Column lg={11}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', paddingTop: '2rem' }}>
                            {/* @ts-ignore */}
                            <AreaChart data={predictionData} options={areaOptions} />
                        </Tile>
                    </Column>
                    <Column lg={5}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <IbmCloud size={32} fill="#78a9ff" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>Conexão de Túnel Watsonx</h4>
                            </div>
                            {/* @ts-ignore */}
                            <GaugeChart data={gaugeData} options={gaugeOptions} />
                        </Tile>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
