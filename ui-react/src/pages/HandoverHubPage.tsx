import {
    Stack, Button, Tile, Section, InlineNotification,
    StructuredListWrapper, StructuredListBody, StructuredListRow,
    StructuredListCell, ProgressIndicator, ProgressStep, Grid, Column,
    AILabel, AILabelContent
} from '@carbon/react';
import { Rocket, CheckmarkFilled, Locked, WatsonHealthAiStatus } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { t } from '../components/LocaleSelectorModal';

export default function HandoverHubPage() {
    return (
        <PageLayout
            pageSubtitle="Handover & Ativação de Ecossistemas"
            helpMode
        >
            <Section style={{ padding: '2rem 0', marginBottom: '2rem' }}>
                <Grid>
                    <Column lg={16}>
                        <Tile style={{ padding: '3rem', backgroundColor: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle)' }}>
                            <h1 className="cds--type-productive-heading-06" style={{ marginBottom: '1.5rem' }}>
                                Seu ecossistema está orquestrado.
                            </h1>
                            <p className="cds--type-body-long-02" style={{ marginBottom: '2rem', maxWidth: '650px', color: 'var(--cds-text-secondary)' }}>
                                A calibração do seu DNA de marca foi concluída. O genOS v1.0.0 (Lumina) agora opera sob suas regras exclusivas de governança e ROI.
                            </p>
                            <Button href="/dashboard" renderIcon={Rocket} size="lg">Acessar Dashboard Principal</Button>
                        </Tile>
                    </Column>
                </Grid>
            </Section>

            <Section>
                <Grid>
                    {/* 2. Resumo de Ativação (Timeline) */}
                    <Column lg={16} style={{ marginBottom: '3rem' }}>
                        <ProgressIndicator currentIndex={4}>
                            <ProgressStep label="Identidade" description="DNA Setup concluído" />
                            <ProgressStep label="Governança" description="RLS & RBAC ativos" />
                            <ProgressStep label="Intelligence" description="Helian Calibrado" />
                            <ProgressStep label="Compliance" description="Auditoria Final" />
                            <ProgressStep label="Handover" description="Entrega das Chaves" />
                        </ProgressIndicator>
                    </Column>

                    {/* 3. Resumo Técnico do DNA (Regras Agency) */}
                    <Column lg={8} md={4} sm={4}>
                        <Tile style={{ height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <AILabel size="xs" autoAlign>
                                    <AILabelContent>
                                        <div style={{ padding: '0.75rem' }}>
                                            <strong>DNA Engine v1.0</strong>
                                            <p style={{ fontSize: '0.875rem' }}>Parâmetros fixos injetados nas Edge Functions para garantir consistência de marca.</p>
                                        </div>
                                    </AILabelContent>
                                </AILabel>
                                <h4 className="cds--type-productive-heading-03" style={{ margin: 0 }}>Configurações de DNA Aplicadas</h4>
                            </div>
                            <p className="cds--type-label-01" style={{ marginBottom: '1rem', color: 'var(--cds-text-secondary)' }}>Regras fixas para geração industrial de conteúdo:</p>
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
                    </Column>

                    {/* 4. Chaves de Segurança e Acesso */}
                    <Column lg={8} md={4} sm={4}>
                        <Tile style={{ borderTop: '4px solid var(--cds-support-success)', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <Locked size={20} fill="var(--cds-support-success)" />
                                <h4 className="cds--type-productive-heading-03" style={{ margin: 0 }}>Status de Governança</h4>
                            </div>
                            <Stack gap={4}>
                                <InlineNotification
                                    kind="success"
                                    title="Isolamento RLS Ativo"
                                    subtitle="Seus dados estão protegidos e isolados por tenant_id."
                                    hideCloseButton
                                    lowContrast
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
                                    <WatsonHealthAiStatus size={20} fill="var(--cds-link-primary)" />
                                    <span className="cds--type-body-short-01">Orquestração Helian: <strong>Online</strong></span>
                                </div>
                            </Stack>
                        </Tile>
                    </Column>
                </Grid>
            </Section>
        </PageLayout>
    );
}
