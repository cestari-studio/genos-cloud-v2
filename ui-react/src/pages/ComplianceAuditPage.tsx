'use client';

import React from 'react';
import {
    Section, Tile, Grid, Column, Stack,
    Tag, Button, CodeSnippet, InlineNotification, TextArea
} from '@carbon/react';
import { Network_4, ThumbsUp, Recommend, DocumentTasks } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';

// Mock data: Um post da "Fila" reprovado no Matrix Grid (Drift Ocorrido)
const auditTarget = {
    id: 'TKT-9921',
    format: 'X Post (Twitter)',
    status: 'Drift',
    driftSource: 'Constraint Kernel - Max Characters Exceeded',
    tenant: 'Cestari Studio',

    // O post real gerado pelo Granite
    generatedText: `Descubra como nossa nova pipeline quântica integra governança RLS diretamente na raiz do seu tenant.
Os resultados dos primeiros testes mostraram um ganho de 340% em assertividade no Share of Voice (SOV) contra o Benchmark A.
Integramos AuraHelian e Watsonx pra fazer isso acontecer.

Assine a newsletter e junte-se aos melhores!

#genOS #CestariStudio #Tech #AI #Growth #Enterprise #B2B #SaaS #Cloud #Quantum Computing #IBM`,

    // Limites originais do Kernel
    limits: {
        maxChars: 280,
        currentChars: 387,
        maxTags: 3,
        currentTags: 11
    }
};

export default function ComplianceAuditPage() {
    return (
        <PageLayout
            title={`Compliance Audit: ${auditTarget.id}`}
            subtitle="Inspeção profunda de violação algorítmica. O Agente Granite violou as diretrizes do Brand DNA."
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
                                            <DocumentTasks fill="#0f62fe" size={24} /> Texto Gerado (Output)
                                        </h4>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6', marginTop: '0.5rem' }}>
                                            Este ativo falhou na inserção autônoma devido ao Constraint Kernel.
                                        </p>
                                    </div>
                                    <Tag type="red" size="md">Reprovado (Drift)</Tag>
                                </div>

                                <InlineNotification
                                    kind="error"
                                    title="Regra Estrutural Quebrada:"
                                    subtitle={auditTarget.driftSource}
                                    lowContrast
                                    hideCloseButton
                                />

                                <div>
                                    <h6 className="cds--type-label-01" style={{ color: '#8d8d8d', marginBottom: '0.5rem' }}>Visual Diff (Bloqueio)</h6>
                                    {/* Using Carbon CodeSnippet for read-only monospaced viewing of the exact string */}
                                    <CodeSnippet type="multi" hideCopyButton>
                                        {auditTarget.generatedText}
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
                                    <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem' }}>
                                        <Network_4 fill="#8a3ffc" size={20} />
                                        Métricas do DNA
                                    </h5>

                                    <div>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Progresso de Caracteres</p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                            <h3 className="cds--type-productive-heading-04" style={{ color: '#fa4d56' }}>
                                                {auditTarget.limits.currentChars}
                                            </h3>
                                            <span style={{ color: '#8d8d8d' }}>/ {auditTarget.limits.maxChars} Max Permitido</span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="cds--type-label-01" style={{ color: '#c6c6c6' }}>Contagem de Hashtags Fixas</p>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                            <h3 className="cds--type-productive-heading-04" style={{ color: '#fa4d56' }}>
                                                {auditTarget.limits.currentTags}
                                            </h3>
                                            <span style={{ color: '#8d8d8d' }}>/ {auditTarget.limits.maxTags} Max (Constraint)</span>
                                        </div>
                                    </div>
                                    <hr style={{ borderColor: '#393939', borderStyle: 'solid' }} />
                                    <Button kind="ghost" size="sm" renderIcon={ThumbsUp}>Aprovar Exceção (Force)</Button>
                                </Stack>
                            </Tile>

                            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', flexGrow: 1 }}>
                                <Stack gap={4}>
                                    <h5 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', display: 'flex', gap: '0.5rem' }}>
                                        <Recommend fill="#24a148" size={20} />
                                        Remediação Autônoma
                                    </h5>
                                    <p className="cds--type-body-short-01" style={{ color: '#c6c6c6' }}>
                                        Injete feedback punitivo no Context Window do Granite para forçar uma re-escrita estrita baseada nas regras violadas acima.
                                    </p>
                                    <TextArea
                                        labelText="Agent System Feedback"
                                        defaultValue="Corrija este post. O limite máximo de caracteres é 280 (incluindo espaços). E remova tags excedentes, permitidas apenas 3."
                                        rows={4}
                                    />
                                    <Button size="sm" kind="primary" style={{ width: '100%' }}>
                                        Re-Orquestrar Granite
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
