'use client';

import React, { useState } from 'react';
import {
    Stack, Tile, Section, Grid, Column, PasswordInput, TextInput,
    Select, SelectItem, Button, Toggle,
    AILabel, AILabelContent, preview__IconIndicator as IconIndicator
} from '@carbon/react';
import {
    Save, SettingsAdjust, WatsonHealthAiStatus
} from '@carbon/icons-react';


export default function APIConnectorHub() {
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success'>('idle');

    return (
        <main className="api-hub-page theme-gray-10">
            <Section style={{ padding: '4rem 2rem', backgroundColor: '#161616', color: '#f4f4f4' }}>
                <h1 className="cds--type-productive-heading-06" style={{ marginBottom: '1rem' }}>API Connector Hub</h1>
                <p className="cds--type-body-long-02" style={{ color: '#c6c6c6', maxWidth: '600px' }}>
                    Gestão centralizada de chaves mestras e roteamento global de modelos agênticos.
                </p>
            </Section>

            <Section style={{ padding: '2rem' }}>
                <Grid>
                    {/* 1. IBM watsonx.ai - Motor Primário */}
                    <Column lg={8} md={8} sm={4}>
                        <Tile style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <Stack gap={1}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h4 className="cds--type-productive-heading-03">IBM watsonx.ai</h4>
                                        <AILabel size="sm">
                                            <AILabelContent>Primary Inference Core</AILabelContent>
                                        </AILabel>
                                    </div>
                                    <p className="cds--type-caption-01">Provedor de modelos Granite para governança enterprise.</p>
                                </Stack>
                                <IconIndicator kind="succeeded" label="Conectado" />
                            </div>
                            <Stack gap={5}>
                                <PasswordInput id="ibm-key" labelText="API Key" value="••••••••••••••••" showPasswordLabel="Mostrar" hidePasswordLabel="Ocultar" />
                                <TextInput id="ibm-project" labelText="Project ID" value="genos-v4-prod-01" />
                                <Select id="ibm-region" labelText="Região" defaultValue="us-south">
                                    <SelectItem value="us-south" text="Dallas (us-south)" />
                                    <SelectItem value="eu-de" text="Frankfurt (eu-de)" />
                                    <SelectItem value="jp-tok" text="Tokyo (jp-tok)" />
                                </Select>
                            </Stack>
                        </Tile>
                    </Column>

                    {/* 2. IBM Quantum - Qiskit Runtime */}
                    <Column lg={8} md={8} sm={4}>
                        <Tile style={{ marginBottom: '1.5rem', borderLeft: '4px solid #8a3ffc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <Stack gap={1}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h4 className="cds--type-productive-heading-03">IBM Quantum</h4>
                                        <AILabel size="sm">
                                            <AILabelContent>Experimental Tensor Nodes</AILabelContent>
                                        </AILabel>
                                    </div>
                                    <p className="cds--type-caption-01">Cálculos de GEO Intelligence e Quantum Learning.</p>
                                </Stack>
                                <IconIndicator kind="pending" label="Ready" />
                            </div>
                            <Stack gap={5}>
                                <PasswordInput id="qiskit-token" labelText="Qiskit Runtime Token" value="••••••••••••••••" />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <TextInput id="qiskit-hub" labelText="Hub" value="ibm-q" />
                                    <TextInput id="qiskit-group" labelText="Group" value="open" />
                                </div>
                                <Toggle id="quantum-prio" labelText="Prioridade Quântica" labelA="Off" labelB="On" defaultToggled />
                            </Stack>
                        </Tile>
                    </Column>

                    {/* 3. Global Model Routing (Orquestração Agêntica) */}
                    <Column lg={16}>
                        <Tile style={{ backgroundColor: '#ffffff', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                                <SettingsAdjust size={24} fill="#0f62fe" />
                                <h4 className="cds--type-productive-heading-04">Roteamento Global de Modelos</h4>
                            </div>

                            <Grid>
                                <Column lg={5}>
                                    <Select id="route-content" labelText="Content Factory (Default LLM)">
                                        <SelectItem value="granite-13b" text="IBM Granite 13B (Recomendado)" />
                                        <SelectItem value="gpt-4o" text="OpenAI GPT-4o" />
                                        <SelectItem value="claude-3" text="Anthropic Claude 3.5" />
                                    </Select>
                                </Column>
                                <Column lg={5}>
                                    <Select id="route-data" labelText="Data Analysis & GEO Intelligence">
                                        <SelectItem value="helian-v2" text="AuraHelian V2 (Quantum-Ready)" />
                                        <SelectItem value="granite-v2" text="IBM Granite V2" />
                                    </Select>
                                </Column>
                                <Column lg={6}>
                                    <div style={{ padding: '1rem', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
                                        <Stack gap={2}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <WatsonHealthAiStatus size={16} fill="#0f62fe" />
                                                <span className="cds--type-label-01">Inteligência de Roteamento</span>
                                            </div>
                                            <p className="cds--type-caption-01">O genOS alterna automaticamente entre provedores para otimizar custo e latência com base nos limites de cada Tenant.</p>
                                        </Stack>
                                    </div>
                                </Column>
                            </Grid>
                        </Tile>
                    </Column>

                    {/* Ações de Rodapé */}
                    <Column lg={16} style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <Button kind="tertiary" onClick={() => setTestStatus('testing')}>
                            Testar Conexões Globais
                        </Button>
                        <Button kind="primary" renderIcon={Save}>
                            Salvar Configurações Mestras
                        </Button>
                    </Column>
                </Grid>
            </Section>
        </main>
    );
}
