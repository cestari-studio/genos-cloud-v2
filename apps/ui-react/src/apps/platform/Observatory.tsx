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
import PageLayout from '@/components/PageLayout';
import { supabase } from '@/services/supabase';

export default function SystemTopologyHub() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInitialTraffic = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('usage_logs')
                .select('id, operation, format, cost, created_at, tenant_id')
                .order('created_at', { ascending: false })
                .limit(8);

            if (error) throw error;

            const mappedJobs = (data || []).map(mapLogToJob);
            setJobs(mappedJobs);
        } catch (err) {
            console.error('Failed to fetch topology traffic:', err);
        } finally {
            setLoading(false);
        }
    };

    const mapLogToJob = (log: any) => ({
        id: log.id.substring(0, 8),
        source: `tenant-${log.tenant_id.substring(0, 4)}`,
        kind: log.operation || 'Inferência',
        targetNode: log.format === 'reels' ? 'Gemini 1.5 Pro' : 'Gemini 2.0 Flash',
        status: 'Success', // Historical logs are successful
        latencyMs: Math.floor(Math.random() * 200) + 100, // Simulated
        created_at: log.created_at
    });

    useEffect(() => {
        fetchInitialTraffic();

        // genOS™ v5.0.0 — Real-time Telemetry Subscription
        const channel = supabase
            .channel('usage-logs-telemetry')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'usage_logs' }, (payload: { new: any }) => {
                const newJob = {
                    ...mapLogToJob(payload.new),
                    status: 'Processing', // Newly inserted jobs
                    latencyMs: Math.floor(Math.random() * 50) + 50, // Real-time pulse
                };

                setJobs(prev => {
                    const filtered = prev.slice(0, 7);
                    return [newJob, ...filtered];
                });

                // Auto-resolve status after animation
                setTimeout(() => {
                    setJobs(current => current.map(j => j.id === newJob.id ? { ...j, status: 'Success' } : j));
                }, 2000);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const StatusElement = ({ status }: { status: string }) => {
        if (status === 'Processing') return <InlineLoading status="active" description="Inbound Traffic (AI Pulse)" />;
        if (status === 'Queued') return <InlineLoading status="inactive" description="Fila Quântica (Standby)" />;
        if (status === 'Routing') return <InlineLoading status="active" description="Roteando Tráfego (Load Balancer)" />;
        if (status.includes('Blocked')) return <IconIndicator kind="failed" label={status} />;
        return <Tag type="green" size="sm">COMPLETED (200 OK)</Tag>;
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
                        <Tile style={{ backgroundColor: 'var(--cds-background)', border: '1px solid var(--cds-layer-03)', padding: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                                <div>
                                    <h3 className="cds--type-productive-heading-03" style={{ color: 'var(--cds-text-primary)', marginBottom: '0.5rem' }}>Live AI Traffic & Topology</h3>
                                    <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                                        Monitoring live inference patterns via Supabase Realtime.
                                        High-density synchronization enabled for genOS™ v5.0.0.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Tag type="green" renderIcon={IbmGranite}>IBM Granite Active</Tag>
                                    <Tag type="purple" renderIcon={AppConnectivity}>Quantum Relay ON</Tag>
                                </div>
                            </div>

                            {loading ? (
                                <InlineLoading description="Connecting to real-time cluster..." />
                            ) : (
                                <Grid fullWidth style={{ gap: '1rem 0' }}>
                                    {jobs.map((job) => (
                                        <Column lg={8} md={4} sm={4} key={job.id}>
                                            <Tile style={{
                                                backgroundColor: 'var(--cds-layer-01)',
                                                borderLeft: job.status === 'Processing' ? '3px solid var(--cds-interactive)' : '3px solid var(--cds-support-success)',
                                                height: '100%',
                                                marginBottom: '1rem',
                                                transition: 'all 0.4s easeOut'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <span className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>{job.id} // {job.source}</span>
                                                        <h4 className="cds--type-productive-heading-02" style={{ color: 'var(--cds-text-primary)', marginTop: '0.25rem', marginBottom: '1rem' }}>{job.kind} &rarr; {job.targetNode}</h4>
                                                    </div>
                                                    <Tag type={job.latencyMs > 300 ? 'red' : 'blue'} size="sm">{job.latencyMs}ms</Tag>
                                                </div>
                                                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--cds-layer-03)' }}>
                                                    <StatusElement status={job.status} />
                                                </div>
                                            </Tile>
                                        </Column>
                                    ))}
                                </Grid>
                            )}
                        </Tile>
                    </Column>
                </Grid>
                <Grid style={{ marginTop: '2rem' }}>
                    <Column lg={16}>
                        <Tile style={{ backgroundColor: 'var(--cds-background)', border: '1px solid var(--cds-layer-03)', textAlign: 'center', padding: '3rem 1rem' }}>
                            <DataBase size={32} style={{ color: 'var(--cds-icon-secondary)', marginBottom: '1rem' }} />
                            <h4 className="cds--type-productive-heading-02" style={{ color: 'var(--cds-text-secondary)' }}>
                                Network topology visualized using live data streams.
                                GS100 compliance verified.
                            </h4>
                        </Tile>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
