'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Stack, Tile, Section, Grid, Column, Tag,
    DataTable, TableContainer, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
    AILabel, AILabelContent, InlineNotification, preview__IconIndicator as IconIndicator
} from '@carbon/react';
import {
    Activity, CloudSatellite,
    SatelliteRadar, Chemistry
} from '@carbon/icons-react';
import { LineChart, MeterChart } from '@carbon/charts-react';

import "@carbon/charts/styles.css";
import PageLayout from '../../components/PageLayout';
import { api } from '../../services/api';
// Health-check uses Edge Function (needs service_role for cross-tenant queries)

// Mock de dados de latência das APIs de IA (ms)
const latencyData = [
    { group: "IBM Granite", date: "2026-02-23T22:00:00Z", value: 120 },
    { group: "IBM Granite", date: "2026-02-23T22:05:00Z", value: 145 },
    { group: "OpenAI GPT-4", date: "2026-02-23T22:00:00Z", value: 350 },
    { group: "OpenAI GPT-4", date: "2026-02-23T22:05:00Z", value: 410 },
    { group: "AuraHelian (Quantum)", date: "2026-02-23T22:00:00Z", value: 85 },
    { group: "AuraHelian (Quantum)", date: "2026-02-23T22:05:00Z", value: 92 },
];

const activeTenantsRows = [
    { id: '1', name: 'Agência Omega', wix_id: 'wix-omega-991', plan: 'Enterprise', status: 'Active', utilization: '88%' },
    { id: '2', name: 'Tech Solutions SA', wix_id: 'wix-tech-012', plan: 'Pro', status: 'Active', utilization: '45%' },
    { id: '3', name: 'Studio Beta', wix_id: 'wix-beta-334', plan: 'Free', status: 'Warning', utilization: '99%' },
    { id: '4', name: 'Retail Corp', wix_id: 'wix-ret-556', plan: 'Enterprise', status: 'Active', utilization: '12%' },
];

const activeTenantsHeaders = [
    { key: 'name', header: 'Organização (Tenant)' },
    { key: 'wix_id', header: 'Wix Bind ID' },
    { key: 'plan', header: 'Plano Ativo' },
    { key: 'status', header: 'Status RLS' },
    { key: 'utilization', header: 'Cota de Uso (Tokens)' },
];

export default function GlobalHealthDashboard() {
    const [health, setHealth] = useState<any>(null);

    useEffect(() => {
        api.edgeFn('ai-health-check').then(setHealth).catch(console.error);
    }, []);

    const healthRows = useMemo(
        () =>
            (health?.checks || []).map((check: any, idx: number) => ({
                id: String(idx),
                label: check.label,
                status: check.status,
                detail: check.detail,
                latency: `${check.latency_ms || 0}ms`,
            })),
        [health]
    );

    return (
        <PageLayout
            title="Root Tenant Observatory"
            subtitle="Painel Administrativo da Cestari Studio: Status em tempo real da orquestração agêntica e infraestrutura quântica."
        >
            <Section>
                <div style={{ marginBottom: '2rem' }}>
                    <InlineNotification
                        kind="info"
                        title="Decisão Autônoma (genOS Routing Agent):"
                        subtitle="Cluster Alpha detectou latência alta na API OpenAI (350ms) nos últimos 5 min. O tráfego de inferência secundário foi roteado provisoriamente para o Node IBM Granite-13b (120ms) para preservar o SLA."
                        lowContrast
                        hideCloseButton
                    />
                </div>
                <Grid>
                    {/* 1. KPIs de Resumo */}
                    <Column lg={4} md={4} sm={4}>
                        <Tile className="status-card" style={{ backgroundColor: '#262626' }}>
                            <Stack gap={3}>
                                <CloudSatellite size={24} fill="#0f62fe" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Clusters Kubernetes</h4>
                                <h2 className="cds--type-productive-heading-05">12 / 12</h2>
                                <IconIndicator kind="succeeded" label="Operacional" />
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile className="status-card" style={{ backgroundColor: '#262626' }}>
                            <Stack gap={3}>
                                <Activity size={24} fill="#24a148" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Uptime Global (24h)</h4>
                                <h2 className="cds--type-productive-heading-05">99.98%</h2>
                                <IconIndicator kind="succeeded" label="Alta Performance" />
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile className="status-card" style={{ backgroundColor: '#262626' }}>
                            <Stack gap={3}>
                                <Chemistry size={24} fill="#8a3ffc" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Qiskit Jobs Pendentes</h4>
                                <h2 className="cds--type-productive-heading-05">04</h2>
                                <IconIndicator kind="pending" label="Processamento Quântico" />
                            </Stack>
                        </Tile>
                    </Column>
                    <Column lg={4} md={4} sm={4}>
                        <Tile className="status-card" style={{ backgroundColor: '#262626', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 0, right: 0 }}>
                                <AILabel size="sm" kind="inline">
                                    <AILabelContent>
                                        <p className="cds--type-label-01">Agente de Auto-Scaling sugere +2 Nodes para suprir a demanda de Drift nos próximos 30m.</p>
                                    </AILabelContent>
                                </AILabel>
                            </div>
                            <Stack gap={3}>
                                <SatelliteRadar size={24} fill="#fa4d56" />
                                <h4 className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Alertas de Drift (AI)</h4>
                                <h2 className="cds--type-productive-heading-05">02</h2>
                                <IconIndicator kind="failed" label="Drift Threshold" />
                            </Stack>
                        </Tile>
                    </Column>

                    {/* Novo: Tabela de Nós Conectados (Hardware) */}
                    <Column lg={16} style={{ marginTop: '2.5rem' }}>
                        <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '1rem 0' }}>
                            <div style={{ padding: '0 1rem' }}>
                                <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Hardware: Status dos Nodes de Inteligência</h4>
                                <div style={{ border: '1px solid #393939' }}>
                                    <DataTable
                                        rows={healthRows}
                                        headers={[
                                            { key: 'label', header: 'Serviço Conectado' },
                                            { key: 'status', header: 'Status' },
                                            { key: 'detail', header: 'Detalhes Técnicos' },
                                            { key: 'latency', header: 'Latência de Resposta' },
                                        ]}
                                    >
                                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                            <Table {...getTableProps()} size="sm">
                                                <TableHead>
                                                    <TableRow>
                                                        {headers.map((header: any) => (
                                                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                                {header.header}
                                                            </TableHeader>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rows.map((row: any) => (
                                                        <TableRow {...getRowProps({ row })} key={row.id}>
                                                            {row.cells.map((cell: any) => (
                                                                <TableCell key={cell.id}>{cell.value}</TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </DataTable>
                                </div>
                            </div>
                        </Tile>
                    </Column>

                    {/* 2. Gráfico de Latência de IA */}
                    <Column lg={16} style={{ marginTop: '2rem' }}>
                        <Tile style={{ backgroundColor: '#262626' }}>
                            <h4 className="cds--type-productive-heading-03" style={{ marginBottom: '1.5rem', color: '#f4f4f4' }}>
                                Latência de Resposta por Modelo (ms)
                            </h4>
                            <LineChart
                                data={latencyData}
                                options={{
                                    title: "Performance de Orquestração",
                                    axes: {
                                        bottom: { title: "Tempo", mapsTo: "date", scaleType: "time" as any },
                                        left: { title: "Latência (ms)", mapsTo: "value" }
                                    },
                                    height: "300px",
                                    theme: "g100",
                                    color: { scale: { "IBM Granite": "#0f62fe", "OpenAI GPT-4": "#005d5d", "AuraHelian (Quantum)": "#8a3ffc" } }
                                }}
                            />
                        </Tile>
                    </Column>

                    {/* 3. Recursos do Sistema (Meter Charts) */}
                    <Column lg={8} style={{ marginTop: '2rem' }}>
                        <Tile style={{ backgroundColor: '#262626' }}>
                            <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Consumo de Memória (Cluster-Alpha)</h4>
                            <MeterChart
                                data={[{ group: "Uso", value: 65 }]}
                                options={{
                                    height: "100px",
                                    theme: "g100",
                                    meter: { peak: 90 },
                                    color: { scale: { "Uso": "#0f62fe" } }
                                }}
                            />
                        </Tile>
                    </Column>
                    <Column lg={8} style={{ marginTop: '2rem' }}>
                        <Tile style={{ backgroundColor: '#262626' }}>
                            <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Carga de CPU (Orchestrator Node)</h4>
                            <MeterChart
                                data={[{ group: "Carga", value: 42 }]}
                                options={{
                                    height: "100px",
                                    theme: "g100",
                                    meter: { peak: 80 },
                                    color: { scale: { "Carga": "#24a148" } }
                                }}
                            />
                        </Tile>
                    </Column>
                    <Column lg={16} style={{ marginTop: '2.5rem' }}>
                        <Tile style={{ backgroundColor: '#262626', padding: '1rem 0' }}>
                            <div style={{ padding: '0 1rem' }}>
                                <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>Roteamento de Tenantes Ativos (Wix Bridge)</h4>
                                <div style={{ border: '1px solid #393939' }}>
                                    <DataTable rows={activeTenantsRows} headers={activeTenantsHeaders}>
                                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                            <Table {...getTableProps()} size="sm">
                                                <TableHead>
                                                    <TableRow>
                                                        {headers.map((header: any) => (
                                                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                                {header.header}
                                                            </TableHeader>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rows.map((row: any) => (
                                                        <TableRow {...getRowProps({ row })} key={row.id}>
                                                            {row.cells.map((cell: any) => (
                                                                <TableCell key={cell.id}>
                                                                    {cell.info.header === 'status' ? (
                                                                        <Tag type={cell.value === 'Active' ? 'green' : 'red'} size="sm">
                                                                            {cell.value}
                                                                        </Tag>
                                                                    ) : cell.info.header === 'utilization' ? (
                                                                        <span style={{ color: parseInt(cell.value) > 90 ? '#fa4d56' : '#c6c6c6' }}>{cell.value}</span>
                                                                    ) : (
                                                                        cell.value
                                                                    )}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </DataTable>
                                </div>
                            </div>
                        </Tile>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
