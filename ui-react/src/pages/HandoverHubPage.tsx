'use client';

import React from 'react';
import {
    Stack, Button, Tile, Section, InlineNotification,
    StructuredListWrapper, StructuredListHead, StructuredListRow,
    StructuredListCell, StructuredListBody, ProgressIndicator, ProgressStep
} from '@carbon/react';
import { Rocket, CheckmarkFilled, Locked, WatsonHealthAiStatus } from '@carbon/icons-react';


export default function HandoverHubPage() {
    return (
        <main className="handover-hub-page theme-gray-10">
            {/* 1. Celebração e Impacto */}
            <Section style={{ padding: '4rem 2rem', backgroundColor: '#161616', color: '#f4f4f4', marginBottom: '2rem' }}>
                <h1 className="cds--type-productive-heading-06" style={{ marginBottom: '1rem' }}>
                    Seu ecossistema está orquestrado.
                </h1>
                <p className="cds--type-body-long-02" style={{ marginBottom: '2rem', maxWidth: '600px', color: '#c6c6c6' }}>
                    A calibração do seu DNA de marca foi concluída. O genOS v1.0.0 (Lumina) agora opera sob suas regras exclusivas de governança e ROI.
                </p>
                <Button href="/dashboard" renderIcon={Rocket}>Acessar Dashboard Principal</Button>
            </Section>

            <Section style={{ padding: '3rem 0' }}>
                <div className="cds--grid">
                    <div className="cds--row">
                        {/* 2. Resumo de Ativação (Timeline) */}
                        <div className="cds--col-lg-16" style={{ marginBottom: '3rem' }}>
                            <ProgressIndicator currentIndex={4}>
                                <ProgressStep label="Identidade" description="DNA Setup concluído" />
                                <ProgressStep label="Governança" description="RLS & RBAC ativos" />
                                <ProgressStep label="Intelligence" description="Helian Calibrado" />
                                <ProgressStep label="Compliance" description="Auditoria Final" />
                                <ProgressStep label="Handover" description="Entrega das Chaves" />
                            </ProgressIndicator>
                        </div>

                        {/* 3. Resumo Técnico do DNA (Regras Agency) */}
                        <div className="cds--col-lg-8">
                            <Tile>
                                <h4 className="cds--type-productive-heading-03">Configurações de DNA Aplicadas</h4>
                                <p style={{ margin: '1rem 0', color: '#525252' }}>Regras fixas para geração industrial de conteúdo:</p>
                                <StructuredListWrapper isCondensed>
                                    <StructuredListBody>
                                        <StructuredListRow>
                                            <StructuredListCell noWrap>Limite de Caracteres</StructuredListCell>
                                            <StructuredListCell><strong>700 chars</strong></StructuredListCell>
                                        </StructuredListRow>
                                        <StructuredListRow>
                                            <StructuredListCell noWrap>Títulos (Carrossel)</StructuredListCell>
                                            <StructuredListCell><strong>Max 5 palavras</strong></StructuredListCell>
                                        </StructuredListRow>
                                        <StructuredListRow>
                                            <StructuredListCell noWrap>Hashtags Fixas</StructuredListCell>
                                            <StructuredListCell>Ativadas</StructuredListCell>
                                        </StructuredListRow>
                                    </StructuredListBody>
                                </StructuredListWrapper>
                            </Tile>
                        </div>

                        {/* 4. Chaves de Segurança e Acesso */}
                        <div className="cds--col-lg-8">
                            <Tile style={{ borderTop: '4px solid #24a148' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Locked fill="#24a148" />
                                    <h4 className="cds--type-productive-heading-03">Status de Governança</h4>
                                </div>
                                <Stack gap={4}>
                                    <InlineNotification
                                        kind="success"
                                        title="Isolamento RLS Ativo"
                                        subtitle="Seus dados estão protegidos e isolados por tenant_id."
                                        hideCloseButton
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <WatsonHealthAiStatus fill="#0f62fe" />
                                        <span>Orquestração Helian: <strong>Online</strong></span>
                                    </div>
                                </Stack>
                            </Tile>
                        </div>
                    </div>
                </div>
            </Section>
        </main>
    );
}
