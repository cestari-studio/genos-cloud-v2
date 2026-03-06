import React, { useState, useEffect } from 'react';
import {
    Section,
    Heading,
    ProgressBar,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    Tag,
    IconButton,
    Layer
} from '@carbon/react';
import { Activity, ChartScatter, Information } from '@carbon/icons-react';

interface QuantumJob {
    id: string;
    backend: string;
    status: 'running' | 'completed' | 'queued' | 'error';
    coherence: number;
    pulse_intensity: number;
    timestamp: string;
}

export default function QuantumPulseTelemetry() {
    const [jobs, setJobs] = useState<QuantumJob[]>([
        { id: 'job_fez_01', backend: 'ibm_fez', status: 'completed', coherence: 0.985, pulse_intensity: 0.82, timestamp: '14:22:01' },
        { id: 'job_mar_02', backend: 'ibm_marrakesh', status: 'running', coherence: 0.912, pulse_intensity: 0.75, timestamp: '14:35:10' },
        { id: 'job_fez_03', backend: 'ibm_fez', status: 'queued', coherence: 0, pulse_intensity: 0, timestamp: '14:40:00' }
    ]);

    return (
        <div className="quantum-telemetry-panel" style={{ marginTop: '2rem', padding: '1.5rem', background: '#1d1d1d', border: '1px solid #333' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity size={24} style={{ fill: '#8a3ffc' }} />
                    <Heading>Quantum Pulse™ Real-time Telemetry</Heading>
                </div>
                <Tag type="purple">IBM Quantum Platform Connected</Tag>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <Layer>
                    <div style={{ padding: '1rem', background: '#262626' }}>
                        <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.5rem' }}>Active Pulse Coherence (Fez)</p>
                        <ProgressBar
                            label="IBM Fez Global Coherence"
                            value={98.5}
                            status="active"
                            helperText="Quantum-Ready: Critical Infrastructure Stable"
                        />
                    </div>
                </Layer>
                <Layer>
                    <div style={{ padding: '1rem', background: '#262626' }}>
                        <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginBottom: '0.5rem' }}>Pulse Energy Injection</p>
                        <ProgressBar
                            label="Energy Gradient"
                            value={75}
                            status="active"
                        />
                    </div>
                </Layer>
            </div>

            <Table size="sm" aria-label="Quantum Job Queue">
                <TableHead>
                    <TableRow>
                        <TableHeader>Job ID</TableHeader>
                        <TableHeader>Backend</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Q-Coherence</TableHeader>
                        <TableHeader>Telemetry</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {jobs.map((job) => (
                        <TableRow key={job.id}>
                            <TableCell style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.75rem' }}>{job.id}</TableCell>
                            <TableCell style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{job.backend}</TableCell>
                            <TableCell>
                                <Tag type={job.status === 'completed' ? 'green' : job.status === 'running' ? 'purple' : 'gray'}>
                                    {job.status}
                                </Tag>
                            </TableCell>
                            <TableCell>{job.coherence > 0 ? `${(job.coherence * 100).toFixed(1)}%` : '---'}</TableCell>
                            <TableCell>
                                <IconButton label="View Pulse Graph" kind="ghost" size="sm">
                                    <ChartScatter size={16} />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <style>{`
                .quantum-telemetry-panel .cds--progress-bar__bar { background-color: #8a3ffc; }
                .quantum-telemetry-panel .cds--progress-bar__fill { background-color: #8a3ffc; }
            `}</style>
        </div>
    );
}
