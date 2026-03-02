'use client';

import React, { useState } from 'react';
import {
    Section, Grid, Column, Tile, Stack, Form, FormGroup, TextInput,
    FileUploader, FileUploaderItem, Button, Dropdown, Toggle, AILabel, AILabelContent,
    preview__IconIndicator as IconIndicator, InlineNotification, Tag
} from '@carbon/react';
import { Store, DocumentImport, ConnectionSignal, SettingsAdjust } from '@carbon/icons-react';
import PageLayout from '../../components/PageLayout';

export default function CommerceCatalog() {
    const [fileStatus, setFileStatus] = useState<'edit' | 'uploading' | 'complete'>('edit');
    const [syncProgress, setSyncProgress] = useState(0);

    const handleUpload = () => {
        setFileStatus('uploading');
        let progress = 0;
        const interval = setInterval(() => {
            progress += 20;
            setSyncProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setFileStatus('complete');
            }
        }, 500);
    };

    return (
        <PageLayout
            pageSubtitle="Commerce — Agentic Commerce Catalog"
        >
            <Section style={{ padding: '2rem' }}>
                <Grid>
                    {/* 1. Stripe Connection Status */}
                    <Column lg={5} md={4} sm={4}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', marginBottom: '2rem', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <Stack gap={1}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4' }}>Stripe ACP</h4>
                                        <AILabel size="sm">
                                            <AILabelContent>Agentic Commerce Protocol</AILabelContent>
                                        </AILabel>
                                    </div>
                                    <p className="cds--type-caption-01" style={{ color: '#c6c6c6' }}>Protocolo Líder de Indústria Mapeado.</p>
                                </Stack>
                                <IconIndicator kind="succeeded" label="Conectado" />
                            </div>
                            <Stack gap={3}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <ConnectionSignal size={16} fill="#24a148" />
                                    <span className="cds--type-body-short-01" style={{ color: '#f4f4f4' }}>Account ID: acct_1NXY...</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <SettingsAdjust size={16} fill="#0f62fe" />
                                    <span className="cds--type-body-short-01" style={{ color: '#f4f4f4' }}>Shared Payment Tokens: Enabled</span>
                                </div>
                            </Stack>
                        </Tile>
                    </Column>

                    {/* 2. File Upload Area */}
                    <Column lg={11} md={8} sm={4}>
                        <Tile style={{ backgroundColor: '#161616', border: '1px solid #393939', marginBottom: '2rem' }}>
                            <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1rem' }}>
                                <DocumentImport size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                Catálogo de Produtos (CSV Synchronization)
                            </h4>
                            <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1.5rem', maxWidth: '600px' }}>
                                O Agentic Commerce exige colunas específicas no CSV como `stripe_product_tax_code`, `name` e `agentic_context_keywords` para o aprendizado da IA.
                            </p>

                            {fileStatus === 'edit' && (
                                <div style={{ border: '1px dashed #525252', padding: '2rem', textAlign: 'center', backgroundColor: '#262626' }}>
                                    <FileUploader
                                        accept={['.csv']}
                                        buttonKind="primary"
                                        buttonLabel="Selecionar CSV"
                                        filenameStatus="edit"
                                        iconDescription="Clear file"
                                        labelDescription="Max file size is 50MB. Apenas CSV."
                                        labelTitle="Upload Inventory File"
                                    />
                                    <Button style={{ marginTop: '1rem' }} onClick={handleUpload}>Sincronizar Catálogo com a Stripe</Button>
                                </div>
                            )}

                            {fileStatus === 'uploading' && (
                                <InlineNotification
                                    kind="info"
                                    title="Sincronizando Metadados"
                                    subtitle={`Integrando ao Stripe ACP... (${syncProgress}%)`}
                                    hideCloseButton
                                />
                            )}

                            {fileStatus === 'complete' && (
                                <Stack gap={4}>
                                    <FileUploaderItem
                                        errorBody="Erro no arquivo"
                                        errorSubject="O tamanho excede o limite"
                                        iconDescription="Deletar"
                                        name="ecommerce_inventory_v3.csv"
                                        status="complete"
                                        onDelete={() => setFileStatus('edit')}
                                    />
                                    <InlineNotification
                                        kind="success"
                                        title="Sincronização Concluída"
                                        subtitle="34 produtos indexados no Stripe. Seus Agentes de Chat WatsonX agora já podem comercializar in-context."
                                    />
                                </Stack>
                            )}
                        </Tile>
                    </Column>

                    {/* 3. Global AI Agent Configuration */}
                    <Column lg={16}>
                        <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939' }}>
                            <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                                In-Context Selling (Agent Logic)
                            </h4>
                            <Grid>
                                <Column lg={8}>
                                    <Form>
                                        <FormGroup legendText="Configurações Padrões do Agente de Checkout" style={{ color: '#f4f4f4' }}>
                                            <Stack gap={5}>
                                                <Toggle
                                                    id="auto-upsell"
                                                    labelText="Cross-sell / Upsell Automático"
                                                    labelA="Offline"
                                                    labelB="Ativo"
                                                    defaultToggled
                                                />
                                                <Dropdown
                                                    id="discount-rules"
                                                    titleText="Desconto Automático por Fechamento Assistido"
                                                    label="Sem Desconto (Apenas MSRP)"
                                                    items={['Sem Desconto', 'Até 5% via Agentic Decision', 'Somente Cupons']}
                                                />
                                            </Stack>
                                        </FormGroup>
                                    </Form>
                                </Column>
                                <Column lg={8}>
                                    <div style={{ backgroundColor: '#161616', padding: '1.5rem', borderLeft: '4px solid #8a3ffc' }}>
                                        <p className="cds--type-productive-heading-01" style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>
                                            Agentic Commerce Flow Preview
                                        </p>
                                        <Stack gap={3}>
                                            <div style={{ padding: '0.5rem', backgroundColor: '#393939', borderRadius: '4px' }}>
                                                <p className="cds--type-body-short-01" style={{ color: '#f4f4f4' }}>
                                                    <strong>User:</strong> Me tire uma dúvida, se eu levar o Plano B eu evito o problema X?
                                                </p>
                                            </div>
                                            <div style={{ padding: '0.5rem', backgroundColor: '#0f62fe', borderRadius: '4px' }}>
                                                <p className="cds--type-body-short-01" style={{ color: '#ffffff' }}>
                                                    <strong>Agent:</strong> Sim. O Plano B tem contingência exata para isso. Gostaria de adquirir sua licença agora? <br /><br />
                                                    <Tag type="cyan">Card de Produto Renderizado (MSRP: $199.00)</Tag>
                                                </p>
                                            </div>
                                        </Stack>
                                    </div>
                                </Column>
                            </Grid>
                        </Tile>
                    </Column>

                </Grid>
            </Section>
        </PageLayout>
    );
}
