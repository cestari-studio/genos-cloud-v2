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
import { api } from '../../../../services/api';
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #333', paddingBottom: '1.5rem' }}>
                    <div>
                        <h2 className="cds--type-productive-heading-04" style={{ color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <SettingsAdjust size={32} style={{ fill: '#8a3ffc' }} />
                            Helian™ Engine Configuration
                        </h2>
                        <p className="cds--type-body-short-01" style={{ color: '#a8a8a8', marginTop: '0.25rem' }}>
                            Manage core AI generation logic and system constraints for <Tag type="purple" size="sm" style={{ margin: 0 }}>Tenant {tenantId?.slice(0, 8) || 'GENOS-ROOT'}</Tag>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: '#8d8d8d', textTransform: 'uppercase', letterSpacing: '1px' }}>Engine Status</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isOptimized ? '#24a148' : '#f1c21b' }}>
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
                            <Tile style={{ backgroundColor: '#1d1d1d', border: '1px solid #333', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Activity size={20} style={{ fill: '#4589ff' }} />
                                        Inference Telemetry
                                    </h4>
                                    <Tag type="blue" size="sm">Aura V5.0.2</Tag>
                                </div>
                                <Grid fullWidth narrow>
                                    {engineMetrics.map((m, i) => (
                                        <Column lg={4} md={4} sm={4} key={i}>
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.875rem', color: '#e0e0e0' }}>{m.label}</span>
                                                    <span style={{ color: m.status === 'high' ? '#42be65' : m.status === 'medium' ? '#f1c21b' : '#fa4d56', fontWeight: 600 }}>
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
                            <Tile style={{ backgroundColor: '#1d1d1d', border: '1px solid #333', borderRadius: '4px' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f4', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Parameter size={20} style={{ fill: '#fa4d56' }} />
                                    Active Constraints & Calibration
                                </h4>
                                <div style={{ background: '#262626', padding: '1rem', borderRadius: '4px' }}>
                                    <OrderedList style={{ marginLeft: '1.5rem' }}>
                                        {activeRules.map((rule, idx) => (
                                            <ListItem key={idx} style={{ marginBottom: '0.75rem', color: '#d1d1d1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>{rule}</span>
                                                    <CheckmarkFilled size={16} style={{ fill: '#24a148' }} />
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
                            <Tile style={{ backgroundColor: '#1d1d1d', border: '1px solid #333', borderTop: '4px solid #8a3ffc' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f4f4f4', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Core System Controls
                                </h4>
                                <Stack gap={5}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', color: '#f4f4f4' }}>Auto-Calibration</div>
                                            <div style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>Real-time weight adjustment</div>
                                        </div>
                                        <Toggle id="engine-auto-cal" labelText="" labelA="" labelB="" defaultToggled size="sm" />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ fontSize: '0.875rem', color: '#f4f4f4' }}>IBM Quantum Pulse</div>
                                                <Flash size={16} style={{ fill: '#8a3ffc' }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>Inject Q-Coherence results</div>
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
                                            <div style={{ fontSize: '0.875rem', color: '#f4f4f4' }}>Deep Search Layer</div>
                                            <div style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>Inject verified vector results</div>
                                        </div>
                                        <Toggle id="engine-deep-search" labelText="" labelA="" labelB="" defaultToggled size="sm" />
                                    </div>

                                    <Button kind="primary" style={{ marginTop: '1rem' }} renderIcon={Flash} disabled={loading}>
                                        Force Re-Calibration
                                    </Button>
                                </Stack>
                            </Tile>

                            {/* Warning Tile */}
                            <Tile style={{ backgroundColor: '#331e21', border: '1px solid #da1e28' }}>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <WarningAltFilled size={20} style={{ fill: '#da1e28', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffb3b8' }}>Governance Lock Active</div>
                                        <p style={{ fontSize: '0.75rem', color: '#ffb3b8', marginTop: '0.25rem' }}>
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
                        color: #8a3ffc;
                        font-weight: 700;
                    }
                    .helian-engine-dashboard .cds--btn--primary {
                        background-color: #8a3ffc;
                    }
                    .helian-engine-dashboard .cds--btn--primary:hover {
                        background-color: #6929c4;
                    }
                `}</style>
            </Stack>
        </motion.div>
    );
}
