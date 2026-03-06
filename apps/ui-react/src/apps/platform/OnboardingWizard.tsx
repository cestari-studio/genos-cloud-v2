import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Theme,
    ProgressIndicator,
    ProgressStep,
    Stack,
    Loading,
    Grid,
    Column,
    ActionableNotification
} from '@carbon/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/shared/contexts/AuthContext';
import { api } from '@/services/api';
import StepContract from './components/Onboarding/StepContract';
import StepAIProjectScope from './components/Onboarding/StepAIProjectScope';
import StepBrandDNA from './components/Onboarding/StepBrandDNA';
import StepProvisioning from './components/Onboarding/StepProvisioning';
import { provisionTenantResources } from '../../services/provisioning-logic';

const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.13,
            ease: [0.2, 0, 0.38, 0.9] as any // standard-easing
        }
    },
    exit: {
        opacity: 0,
        x: -20,
        transition: {
            duration: 0.11,
            ease: [0.2, 0, 0.38, 0.9] as any
        }
    }
};

export default function OnboardingWizard() {
    const { me, refreshMe } = useAuth();
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dnaProposal, setDnaProposal] = useState<any>(null);

    // Discovery Gate: Intelligent auto-skip to the correct state
    useEffect(() => {
        const initializeDiscovery = async () => {
            if (!me?.tenant?.id) return;

            try {
                // 1. Check Contract
                if (!me.config?.contract_signed) {
                    setCurrentStep(0);
                    return;
                }

                // 2. Check BrandDNA (using direct supabase client)
                const dna = await api.getBrandDNA(me.tenant.id).catch(() => null);
                if (!dna) {
                    setCurrentStep(1);
                    return;
                }

                // 3. Check Projects
                const { count } = await api.edgeFn<any>('content-factory-ai', {
                    action: 'check-projects',
                    tenantId: me.tenant.id
                }).catch(() => ({ count: 0 }));

                if (!count || count === 0) {
                    setCurrentStep(2); // Start AI Scope if no projects found
                    return;
                }

                // 4. Default to BrandDNA review or finish
                setCurrentStep(2);
            } catch (err) {
                console.warn('[DiscoveryGate] Auto-skip failed:', err);
            }
        };

        if (me?.tenant?.id) {
            initializeDiscovery();
        }
    }, [me?.tenant?.id]); // Only run when tenant context is resolved

    const steps = [
        { label: 'Agreement', description: 'Legal & SLA' },
        { label: 'Intelligence', description: 'AI Project Scope' },
        { label: 'BrandDNA™', description: 'Vector Calibration' },
        { label: 'Provisioning', description: 'Resource Activation' }
    ];

    const handleAcceptContract = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!me?.tenant?.id) throw new Error('No tenant context found');
            await api.signContract(me.tenant.id, {
                accepted_version: '5.0.0',
                platform: 'genOS-Cloud-v2'
            });
            await refreshMe();
            setCurrentStep(1);
        } catch (err: any) {
            setError(err.message || 'Failed to sign contract');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteScope = async (briefing: any) => {
        setLoading(true);
        setError(null);
        try {
            if (!me?.tenant?.id) throw new Error('No tenant context found');

            // Save basic brand info first
            await api.saveBrandDNA(me.tenant.id, {
                persona_name: briefing.projectName,
                industry: briefing.industry,
                brand_story: briefing.description
            });

            // Generate AI Proposal
            const formattedBriefing = {
                brandName: briefing.projectName || '',
                industry: briefing.industry || '',
                brandStory: briefing.description || '',
                targetAudience: briefing.targetPlatforms ? briefing.targetPlatforms.join(', ') : ''
            };
            const proposal = await api.generateDNAProposal(me.tenant.id, formattedBriefing);
            setDnaProposal(proposal);
            setCurrentStep(2);
        } catch (err: any) {
            setError(err.message || 'AI calibration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDNA = async (finalDna: any) => {
        setLoading(true);
        setError(null);
        try {
            if (!me?.tenant?.id) throw new Error('No tenant context found');

            // 1. Save finalized DNA
            await api.saveBrandDNA(me.tenant.id, finalDna);

            // 2. Vectorize for Helian™ Semantic Search
            await api.vectorizeDNA(me.tenant.id, finalDna);

            // 3. Move to Provisioning Step
            setCurrentStep(3);
        } catch (err: any) {
            setError(err.message || 'Vectorization failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizeProvisioning = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!me?.tenant?.id) throw new Error('No tenant context found');

            // 1. Run Transactional Provisioning
            const tier = me.config?.schedule_tier || me.tenant?.plan || 'starter';
            await provisionTenantResources(me.tenant.id, tier);

            // 2. Mark onboarding as complete
            await api.completeOnboarding(me.tenant.id);

            await refreshMe();
            navigate('/content-factory/posts');
        } catch (err: any) {
            setError(err.message || 'Provisioning failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Theme theme="g100">
            <div className="onboarding-wizard-container" style={{
                minHeight: '100vh',
                backgroundColor: '#161616',
                color: '#f4f4f4',
                padding: '3rem 0'
            }}>
                <Grid>
                    <Column lg={16} md={8} sm={4}>
                        <div className="wizard-header" style={{ textAlign: 'center', marginBottom: '4rem' }}>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 300, marginBottom: '1rem' }}>
                                genOS™ <span style={{ fontWeight: 600 }}>v5.0.0</span>
                            </h1>
                            <p style={{ color: '#a8a8a8', fontSize: '1.125rem' }}>
                                Industrial Autonomy Calibration
                            </p>
                        </div>
                    </Column>

                    <Column lg={{ span: 10, offset: 3 }} md={8} sm={4}>
                        <div className="wizard-card" style={{
                            backgroundColor: '#262626',
                            padding: '3rem',
                            border: '1px solid #393939',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                            minHeight: '400px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <ProgressIndicator
                                currentIndex={currentStep}
                                spaceEqually
                                style={{ marginBottom: '4rem' }}
                            >
                                {steps.map((step, idx) => (
                                    <ProgressStep
                                        key={idx}
                                        label={step.label}
                                        description={step.description}
                                    />
                                ))}
                            </ProgressIndicator>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    variants={stepVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="step-content"
                                >
                                    {currentStep === 0 && (
                                        <StepContract
                                            onAccept={handleAcceptContract}
                                            loading={loading}
                                            error={error}
                                        />
                                    )}

                                    {currentStep === 1 && (
                                        <StepAIProjectScope
                                            onComplete={handleCompleteScope}
                                            loading={loading}
                                            error={error}
                                        />
                                    )}

                                    {currentStep === 2 && (
                                        <StepBrandDNA
                                            proposal={dnaProposal}
                                            onConfirm={handleConfirmDNA}
                                            loading={loading}
                                            error={error}
                                        />
                                    )}

                                    {currentStep === 3 && (
                                        <StepProvisioning
                                            onComplete={handleFinalizeProvisioning}
                                            tenantTier={me?.config?.schedule_tier || 'starter'}
                                            loading={loading}
                                            error={error}
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </Column>
                </Grid>

                {loading && <Loading withOverlay={true} description="Syncing with Cloud..." />}
            </div>

            <style>{`
        .step-title {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          font-weight: 500;
        }
        .step-description {
          color: #a8a8a8;
          margin-bottom: 2rem;
          max-width: 500px;
        }
      `}</style>
        </Theme>
    );
}
