import React, { useState, useEffect } from 'react';
import {
    Tile,
    Stack,
    Tag,
    ProgressBar,
    OrderedList,
    ListItem,
    Button,
    Grid,
    Column,
    Toggle,
    Section,
    IconButton,
    SkeletonPlaceholder
} from '@carbon/react';
import {
    Activity,
    SettingsAdjust,
    Flash,
    CheckmarkFilled,
    WarningAltFilled,
    Information,
    Parameter,
    ChartCombo
} from '@carbon/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../../../../config/locale';
import { api } from '@/services/api';
import QuantumPulseTelemetry from './QuantumPulseTelemetry';
import { QuantumSkeleton } from './QuantumSkeleton';



export default function HelianEngine() {
    const [isOptimized, setIsOptimized] = useState(true);
    const [isQuantumActive, setIsQuantumActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const tenantId = api.getActiveTenantId();

    useEffect(() => {
        // Simulate initial system calibration
        const timer = setTimeout(() => setLoading(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    const engineMetrics = [
        { label: 'Semantic Alignment', value: 94, status: 'high' },
        { label: 'Token Efficiency', value: 88, status: 'medium' },
        { label: 'Inference Velocity', value: 91, status: 'high' },
        { label: 'Context Density', value: 76, status: 'low' }
    ];

    const activeRules = [
        'GS100 Regional Compliance Active',
        'Zero-Cross Tone Barrier Enforced',
        'Multi-Tenant Data Isolation (Plex)',
        'Heuristic Quality Filter (Scoring > 0.85)',
        'Enterprise Brand DNA Projection'
    ];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="helian-engine-dashboard"
            style={{ padding: '1rem' }}
        >
            <Stack gap={6}>
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--cds-border-subtle-01)', paddingBottom: '1.5rem' }}>
                    <div>
                        <h2 className="cds--type-productive-heading-04" style={{ color: 'var(--cds-text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <SettingsAdjust size={32} style={{ fill: 'var(--cds-support-info)' }} />
                            Helian™ Engine Configuration
                        </h2>
                        <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)', marginTop: '0.25rem' }}>
                            Manage core AI generation logic and system constraints for <Tag type="purple" size="sm" style={{ margin: 0 }}>Tenant {tenantId?.slice(0, 8) || 'GENOS-ROOT'}</Tag>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)', textTransform: 'uppercase', letterSpacing: '1px' }}>Engine Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isOptimized ? 'var(--cds-support-success)' : 'var(--cds-support-warning)' }}>
                                <Flash size={16} />
                                <strong style={{ fontSize: '1rem' }}>{isOptimized ? 'OPTIMIZED' : 'CALIBRATING'}</strong>
                            </div>
                        </div>
                        <Button kind="ghost" hasIconOnly renderIcon={Information} iconDescription="Engine documentation" size="lg" tooltipPosition="bottom" />
                    </div>
                </div>

                <Grid fullWidth narrow>
                    <Column lg={10} md={8} sm={4}>
                        <Stack gap={6}>
                            {/* Real-time Telemetry Tile */}
                            <Tile style={{ backgroundColor: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Activity size={20} style={{ fill: 'var(--cds-interactive)' }} />
                                        Inference Telemetry
                                    </h4>
                                    <Tag type="blue" size="sm">Aura V5.0.2</Tag>
                                </div>
                                <Grid fullWidth narrow>
                                    {engineMetrics.map((m, i) => (
                                        <Column lg={4} md={4} sm={4} key={i}>
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.875rem', color: 'var(--cds-text-primary)' }}>{m.label}</span>
                                                    <span style={{ color: m.status === 'high' ? 'var(--cds-support-success)' : m.status === 'medium' ? 'var(--cds-support-warning)' : 'var(--cds-support-error)', fontWeight: 600 }}>
                                                        {m.value}%
                                                    </span>
                                                </div>
                                                <ProgressBar
                                                    value={m.value}
                                                    max={100}
                                                    label=""
                                                    hideLabel
                                                    size="small"
                                                    status={m.status === 'high' ? 'finished' : m.status === 'medium' ? 'active' : 'error'}
                                                />
                                            </div>
                                        </Column>
                                    ))}
                                </Grid>
                            </Tile>

                            {/* Active Constraints */}
                            <Tile style={{ backgroundColor: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderRadius: '4px' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Parameter size={20} style={{ fill: 'var(--cds-support-error)' }} />
                                    Active Constraints & Calibration
                                </h4>
                                <div style={{ background: 'var(--cds-layer-01)', padding: '1rem', borderRadius: '4px' }}>
                                    <OrderedList style={{ marginLeft: '1.5rem' }}>
                                        {activeRules.map((rule, idx) => (
                                            <ListItem key={idx} style={{ marginBottom: '0.75rem', color: 'var(--cds-text-primary)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>{rule}</span>
                                                    <CheckmarkFilled size={16} style={{ fill: 'var(--cds-support-success)' }} />
                                                </div>
                                            </ListItem>
                                        ))}
                                    </OrderedList>
                                </div>
                            </Tile>
                        </Stack>
                    </Column>

                    <Column lg={6} md={8} sm={4}>
                        <Stack gap={6}>
                            {/* Controls Tile */}
                            <Tile style={{ backgroundColor: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)', borderTop: '4px solid var(--cds-support-info)' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-text-primary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Core System Controls
                                </h4>
                                <Stack gap={5}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-primary)' }}>Auto-Calibration</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)' }}>Real-time weight adjustment</div>
                                        </div>
                                        <Toggle id="engine-auto-cal" labelText="" labelA="" labelB="" defaultToggled size="sm" />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-primary)' }}>IBM Quantum Pulse</div>
                                                <Flash size={16} style={{ fill: 'var(--cds-support-info)' }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)' }}>Inject Q-Coherence results</div>
                                        </div>
                                        <Toggle
                                            id="engine-quantum-pulse"
                                            labelText="" labelA="" labelB=""
                                            toggled={isQuantumActive}
                                            onToggle={() => setIsQuantumActive(!isQuantumActive)}
                                            size="sm"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-primary)' }}>Deep Search Layer</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)' }}>Inject verified vector results</div>
                                        </div>
                                        <Toggle id="engine-deep-search" labelText="" labelA="" labelB="" defaultToggled size="sm" />
                                    </div>

                                    <Button kind="primary" style={{ marginTop: '1rem' }} renderIcon={Flash} disabled={loading}>
                                        Force Re-Calibration
                                    </Button>
                                </Stack>
                            </Tile>

                            {/* Warning Tile */}
                            <Tile style={{ backgroundColor: '#331e21', border: '1px solid var(--cds-support-error)' }}>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <WarningAltFilled size={20} style={{ fill: 'var(--cds-support-error)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--cds-support-error)' }}>Governance Lock Active</div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--cds-support-error)', marginTop: '0.25rem' }}>
                                            Heuristic safety barriers are currently locked by Master Admin.
                                            Manual bypass is restricted to Tier-3 Tenants.
                                        </p>
                                    </div>
                                </div>
                            </Tile>
                        </Stack>
                    </Column>
                </Grid>

                {/* Quantum Pulse Telemetry Section */}
                <AnimatePresence>
                    {isQuantumActive && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                        >
                            {loading ? <QuantumSkeleton /> : <QuantumPulseTelemetry />}
                        </motion.div>
                    )}
                </AnimatePresence>

                <style>{`
                    .helian-engine-dashboard .cds--progress-bar__bar {
                        border-radius: 4px;
                    }
                    .helian-engine-dashboard .cds--ordered-list__item::before {
                        color: var(--cds-support-info);
                        font-weight: 700;
                    }
                    .helian-engine-dashboard .cds--btn--primary {
                        background-color: var(--cds-support-info);
                    }
                    .helian-engine-dashboard .cds--btn--primary:hover {
                        background-color: #6929c4;
                    }
                `}</style>
            </Stack>
        </motion.div>
    );
}
