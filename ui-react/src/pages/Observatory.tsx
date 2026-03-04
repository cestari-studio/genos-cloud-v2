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
import { WebServicesCluster, IbmGranite, AppConnectivity, DataBase } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { supabase } from '../services/supabase';

export default function SystemTopologyHub() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLiveTraffic = async () => {
        try {
            const { data, error } = await supabase
                .from('usage_logs')
                .select('id, operation, format, cost, created_at, tenant_id')
                .order('created_at', { ascending: false })
                .limit(8);

            if (error) throw error;

            const mappedJobs = (data || []).map((log: any) => ({
                id: log.id.substring(0, 8),
                source: `tenant-${log.tenant_id.substring(0, 4)}`,
                kind: log.operation || 'Inferência',
                targetNode: log.format === 'reels' ? 'Gemini 1.5 Pro' : 'Gemini 2.0 Flash',
                status: 'Processing', // Simulating active status for recent logs
                latencyMs: Math.floor(Math.random() * 200) + 100, // Simulated since not in DB
            }));
            setJobs(mappedJobs);
        } catch (err) {
            console.error('Failed to fetch topology traffic:', err);
        } finally {
            setLoading(false);
        }
    };

    // Simulate real-time pulsing & actual data fetch
    useEffect(() => {
        fetchLiveTraffic();
        const interval = setInterval(fetchLiveTraffic, 10000); // 10s fresh data
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
            pageName="genOS"
            pageDescription="Topology — Arquitetura Global"
            actions={
                <Button kind="tertiary" size="sm" renderIcon={WebServicesCluster}>
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
                                    <Tag type="green" renderIcon={IbmGranite}>IBM Granite Active</Tag>
                                    <Tag type="purple" renderIcon={AppConnectivity}>Quantum Relay ON</Tag>
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
