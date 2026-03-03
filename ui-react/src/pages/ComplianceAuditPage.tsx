'use client';

import React from 'react';
import {
    Section, Tile, Grid, Column, Stack,
    Tag, Button, CodeSnippet, InlineNotification, TextArea,
    AILabel, AILabelContent
} from '@carbon/react';
import { Network_4, ThumbsUp, Recommend, DocumentTasks } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { t } from '../config/locale';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function ComplianceAuditPage() {
    const { me } = useAuth();
    const [auditData, setAuditData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const loadAudit = useCallback(async () => {
        const tenantId = api.getActiveTenantId();
        if (!tenantId) {
            setLoading(false);
            return;
        }

        try {
            // Fetch the latest evaluation for this tenant, preferring ones with lower scores or rejected status
            const { data, error } = await supabase
                .from('quality_evaluations')
                .select('*, posts(title, format, status, generated_text)')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setAuditData(data);
            }
        } catch (err) {
            console.error('Error loading compliance audit:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAudit();
    }, [loadAudit]);

    if (loading) {
        return (
            <PageLayout pageName="Audit Compliance" helpMode>
                <Section style={{ padding: '2rem' }}>
                    <InlineNotification kind="info" title="Carregando..." subtitle="Buscando as últimas avaliações de compliance." hideCloseButton />
                </Section>
            </PageLayout>
        );
    }

    if (!auditData) {
        return (
            <PageLayout pageName="Audit Compliance" helpMode>
                <Section>
                    <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', textAlign: 'center', padding: '4rem' }}>
                        <DocumentTasks size={48} fill="#393939" style={{ marginBottom: '1rem' }} />
                        <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4' }}>Nenhuma Auditoria Pendente</h4>
                        <p style={{ color: '#c6c6c6' }}>Todos os seus posts estão em conformidade com o Brand DNA ou nenhuma avaliação foi gerada ainda.</p>
                    </Tile>
                </Section>
            </PageLayout>
        );
    }

    const post = auditData.posts || {};
    const metrics = auditData.metrics || {};
    const feedback = auditData.feedback || '';
    const isRejected = (auditData.score || 100) < 70;

    return (
        <PageLayout
            pageName="Content Factory | Audit Compliance"
            pageDescription="Valide e corrija posts antes de publicar — conformidade automatizada com IA."
            helpMode
        >
            <Section>
                <Grid>
                    {/* Coluna Esquerda: O Output Falho e Highlight */}
                    <Column lg={8} md={8} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', height: '100%' }}>
                            <Stack gap={5}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <DocumentTasks fill="#0f62fe" size={24} /> {t('complianceGeneratedOutput')}
                                        </h4>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>
                                            {t('complianceFailedInsertion')}
                                        </p>
                                    </div>
                                    <Tag type="red" size="md">{t('complianceRejected')}</Tag>
                                </div>

                                <InlineNotification
                                    kind="error"
                                    title={t('complianceStructuralBroken')}
                                    subtitle={auditData.error_type || 'Constraint Drift'}
                                    lowContrast
                                    hideCloseButton
                                />

                                <div>
                                    <h6 className="cds--type-label-01" style={{ color: '#8d8d8d', marginBottom: '0.5rem' }}>{t('complianceVisualDiff')}</h6>
                                    {/* Using Carbon CodeSnippet for read-only monospaced viewing of the exact string */}
                                    <CodeSnippet type="multi" hideCopyButton>
                                        {post.generated_text || auditData.raw_response || 'No content found'}
                                    </CodeSnippet>
                                </div>
                            </Stack>
                        </Tile>
                    </Column>

                    {/* Coluna Direita: O Relatório do Kernel e Remediation */}
                    <Column lg={4} md={4} sm={4}>
                        <Stack gap={5} style={{ height: '100%' }}>
                            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                                <Stack gap={4}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AILabel size="xs" autoAlign>
                                            <AILabelContent>
                                                <div style={{ padding: '0.75rem' }}>
                                                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Métricas de Conformidade</p>
                                                    <p style={{ fontSize: '0.875rem' }}>O kernel de compliance verifica o output contra as regras do Brand DNA em tempo real.</p>
                                                </div>
                                            </AILabelContent>
                                        </AILabel>
                                        <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem', margin: 0 }}>
                                            <Network_4 fill="#8a3ffc" size={20} />
                                            {t('complianceDnaMetrics')}
                                        </h5>
                                    </div>

                                    <div>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6' }}>{t('complianceCharProgress')}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                            <h3 className="cds--type-productive-heading-04" style={{ color: isRejected ? '#fa4d56' : '#42be65' }}>
                                                {metrics.char_count || 0}
                                            </h3>
                                            <span style={{ color: '#8d8d8d' }}>/ {metrics.char_limit || 280} {t('complianceMaxAllowed')}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6' }}>{t('complianceHashtagCount')}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                            <h3 className="cds--type-productive-heading-04" style={{ color: isRejected ? '#fa4d56' : '#42be65' }}>
                                                {metrics.hashtag_count || 0}
                                            </h3>
                                            <span style={{ color: '#8d8d8d' }}>/ {metrics.hashtag_limit || 5} {t('complianceMaxConstraint')}</span>
                                        </div>
                                    </div>
                                    <hr style={{ borderColor: '#393939', borderStyle: 'solid' }} />
                                    <Button kind="ghost" size="sm" renderIcon={ThumbsUp}>{t('complianceApproveException')}</Button>
                                </Stack>
                            </Tile>

                            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', flexGrow: 1 }}>
                                <Stack gap={4}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AILabel size="xs" autoAlign>
                                            <AILabelContent>
                                                <div style={{ padding: '0.75rem' }}>
                                                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Sugestão de Remediação</p>
                                                    <p style={{ fontSize: '0.875rem' }}>IA sugere ajustes baseados no motivo da falha de compliance.</p>
                                                </div>
                                            </AILabelContent>
                                        </AILabel>
                                        <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem', margin: 0 }}>
                                            <Recommend fill="#24a148" size={20} />
                                            {t('complianceRemediation')}
                                        </h5>
                                    </div>
                                    <p className="cds--type-body-short-01" style={{ color: '#c6c6c6' }}>
                                        {t('complianceRemediationDesc')}
                                    </p>
                                    <TextArea
                                        id="agent-feedback"
                                        labelText={t('complianceAgentFeedback')}
                                        value={feedback}
                                        readOnly
                                        rows={4}
                                    />
                                    <Button size="sm" kind="primary" style={{ width: '100%' }}>
                                        {t('complianceReorchestrate')}
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
