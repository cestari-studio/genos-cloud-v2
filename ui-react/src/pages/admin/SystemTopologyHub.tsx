import React, { useState, useEffect } from 'react';
import {
    Grid,
    Column,
    Tile,
    Section,
    Stack,
    Tag,
    InlineLoading,
    Button,
    preview__IconIndicator as IconIndicator
} from '@carbon/react';
import { Network_4, WatsonHealthAiStatus, CloudSatellite, DataBase } from '@carbon/icons-react';
import PageLayout from '../../components/PageLayout';

// Mock in-flight routing jobs (Live)
const MOCK_LIVE_JOBS = [
    { id: 'job_4821', source: 'wix-omega-991', kind: 'Generation', targetNode: 'IBM Granite 13B', status: 'Processing', latencyMs: 124 },
    { id: 'job_4822', source: 'wix-tech-012', kind: 'Vector Embed', targetNode: 'AuraHelian (Quantum)', status: 'Routing', latencyMs: 32 },
    { id: 'job_4823', source: 'wix-ret-556', kind: 'Classification', targetNode: 'OpenAI GPT-4', status: 'Blocked (Drift)', latencyMs: 405 },
    { id: 'job_4824', source: 'wix-omega-991', kind: 'RLS DB Read', targetNode: 'Supabase US-East', status: 'Queued', latencyMs: 5 },
];

export default function SystemTopologyHub() {
    const [jobs, setJobs] = useState(MOCK_LIVE_JOBS);

    // Simulate real-time pulsing
    useEffect(() => {
        const interval = setInterval(() => {
            setJobs([...MOCK_LIVE_JOBS].sort(() => Math.random() - 0.5));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const StatusElement = ({ status }: { status: string }) => {
        if (status === 'Processing') return <InlineLoading status="active" description="Processing (Inferência)" />;
        if (status === 'Queued') return <InlineLoading status="inactive" description="Fila Quântica (Standby)" />;
        if (status === 'Routing') return <InlineLoading status="active" description="Roteando Tráfego (Load Balancer)" />;
        if (status.includes('Blocked')) return <IconIndicator kind="failed" label={status} />;
        return <Tag type="blue">{status}</Tag>;
    };

    return (
        <PageLayout
            title="Cestari Studio Topology | Arquitetura Global"
            subtitle="Node-Graph Canvas (Live Mode): Visualização de Jobs de inferência rodando em tempo real na orquestração agêntica."
            actions={
                <Button kind="tertiary" size="sm" renderIcon={Network_4}>
                    Recalibrar Fila
                </Button>
            }
        >
            <Section>
                <Grid>
                    <Column lg={16}>
                        <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', padding: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                <div>
                                    <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Tráfego Global de IA em Tempo Real</h3>
                                    <p className="cds--type-body-short-01" style={{ color: '#c6c6c6' }}>Os fluxogramas estáticos foram depreciados. Esta tela opera como um Canvas monitorando o Constraint Kernel Edge em live mode.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Tag type="green" renderIcon={WatsonHealthAiStatus}>IBM Granite Active</Tag>
                                    <Tag type="purple" renderIcon={CloudSatellite}>Quantum Relay ON</Tag>
                                </div>
                            </div>

                            <Grid fullWidth style={{ gap: '1rem 0' }}>
                                {jobs.map((job) => (
                                    <Column lg={8} md={4} sm={4} key={job.id}>
                                        <Tile style={{ backgroundColor: '#262626', borderLeft: job.status.includes('Blocked') ? '3px solid #fa4d56' : '3px solid #0f62fe', height: '100%', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <span className="cds--type-label-01" style={{ color: '#8d8d8d' }}>{job.id} // {job.source}</span>
                                                    <h4 className="cds--type-productive-heading-02" style={{ color: '#f4f4f4', marginTop: '0.25rem', marginBottom: '1rem' }}>{job.kind} &rarr; {job.targetNode}</h4>
                                                </div>
                                                <Tag type={job.latencyMs > 300 ? 'red' : 'blue'} size="sm">{job.latencyMs}ms</Tag>
                                            </div>
                                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #393939' }}>
                                                <StatusElement status={job.status} />
                                            </div>
                                        </Tile>
                                    </Column>
                                ))}
                            </Grid>
                        </Tile>
                    </Column>
                </Grid>
                <Grid style={{ marginTop: '2rem' }}>
                    <Column lg={16}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', textAlign: 'center', padding: '3rem 1rem' }}>
                            <DataBase size={32} style={{ color: '#8d8d8d', marginBottom: '1rem' }} />
                            <h4 className="cds--type-productive-heading-02" style={{ color: '#c6c6c6' }}>Os diagramas estáticos Mermaid foram movidos para a área de Documentação do Desenvolvedor.</h4>
                        </Tile>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
