import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SYSTEM_VERSIONS } from '../config/versions';
import { useAuth } from '../contexts/AuthContext';
import {
    Button, Modal, Stack, Tag, Tile,
    Tabs, Tab, TabList, TabPanels, TabPanel,
    AILabel, AILabelContent,
    StructuredListWrapper, StructuredListBody,
    StructuredListRow, StructuredListCell
} from '@carbon/react';
import {
    ArrowRight,
    DataView, IbmGranite,
    DataAnalytics, DocumentSigned,
    AiObservability, Cognitive, CalendarHeatMap,
    CheckmarkFilled, Renew
} from '@carbon/icons-react';

export default function Console() {
    const navigate = useNavigate();
    const { me } = useAuth();
    const companyName = me.tenant?.name || 'genOS';

    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const version = import.meta.env.VITE_APP_VERSION || '1.0.0';
    const [changelog, setChangelog] = useState<any>(null);

    useEffect(() => {
        fetch('/changelog.json')
            .then(r => r.json())
            .then(data => setChangelog(data.updates?.[0]))
            .catch(console.error);
    }, []);

    const features = [
        { key: 'cf', label: 'Content Factory', icon: <DataView size={20} />, route: '/content-factory' },
        { key: 'dna', label: 'Brand DNA', icon: <Cognitive size={20} />, route: '/brand-dna' },
        { key: 'schedule', label: 'Scheduler', icon: <CalendarHeatMap size={20} />, route: '/schedule' },
        { key: 'analytics', label: 'Analytics', icon: <DataAnalytics size={20} />, route: '/analytics' },
        { key: 'quality', label: 'Quality Gate', icon: <AiObservability size={20} />, route: '/quality-gate' },
        { key: 'billing', label: 'Billing', icon: <DocumentSigned size={20} />, route: '/settings' },
    ];

    return (
        <div className="console-dashboard">
            {/* ─── Greeting Overlay ─────────────────────────────────────────── */}
            <div className="console-greeting-overlay cds--css-grid" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
                <div className="cds--css-grid-column cds--col-span-12 cds--col-span-md-8 cds--col-span-sm-4">
                    <h4 className="console-greeting__tenant" style={{ textTransform: 'none' }}>Olá {companyName}</h4>
                    <h3 className="console-greeting-title">genOS™ Cloud Platform</h3>
                    <p className="console-greeting__desc" style={{ display: 'flex', alignItems: 'center', fontSize: '20px', margin: 0 }}>
                        v{version}
                        <Button kind="tertiary" size="sm" onClick={() => setIsAboutModalOpen(true)} style={{ marginLeft: '1rem' }}>
                            Saiba mais
                        </Button>
                    </p>
                </div>
            </div>

            {/* ─── Modal Sobre — Tabbed ──────────────────────────────────────── */}
            <Modal
                open={isAboutModalOpen}
                onRequestClose={() => setIsAboutModalOpen(false)}
                passiveModal
                modalHeading="genOS™ Cloud Platform"
                modalLabel={`Versão ${version}`}
                size="lg"
                decorator={
                    <AILabel autoAlign>
                        <AILabelContent>
                            <Stack gap={3}>
                                <div>
                                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>AI EXPLAINED</p>
                                    <p className="cds--type-productive-heading-05">98%</p>
                                    <p className="cds--type-label-01">Brand Compliance Score</p>
                                    <p className="cds--type-body-short-01" style={{ marginTop: '0.5rem' }}>
                                        O genOS™ utiliza redes neurais treinadas especificamente para cada marca, garantindo que toda geração respeite o tom de voz e os critérios de compliance em tempo real.
                                    </p>
                                </div>
                                <div className="cds--ai-label-content__divider" />
                                <Stack gap={1}>
                                    <p className="cds--type-label-01" style={{ color: 'var(--cds-text-helper)' }}>Tipo de modelo</p>
                                    <p className="cds--type-body-short-02" style={{ fontWeight: 600 }}>Foundation model — Gemini 2.0</p>
                                </Stack>
                            </Stack>
                        </AILabelContent>
                    </AILabel>
                }
            >
                <Tabs>
                    <TabList aria-label="Funcionalidades genOS" contained>
                        <Tab renderIcon={IbmGranite}>Plataforma</Tab>
                        <Tab renderIcon={DataView}>Content Factory</Tab>
                        <Tab renderIcon={Cognitive}>Brand DNA</Tab>
                        <Tab renderIcon={CalendarHeatMap}>Scheduler</Tab>
                        <Tab renderIcon={DataAnalytics}>Analytics</Tab>
                        <Tab renderIcon={DocumentSigned}>Quality Gate</Tab>
                    </TabList>
                    <TabPanels>
                        {/* ── Overview ─────────────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <div>
                                    <h4 className="cds--type-productive-heading-04" style={{ marginBottom: '1.25rem', textAlign: 'left', fontWeight: 600 }}>
                                        A Nova Fronteira da Inteligência de Marca
                                    </h4>
                                    <p className="cds--type-body-long-01">
                                        O genOS™ Cloud Platform não é apenas uma ferramenta de IA, é o sistema operacional da comunicação da sua empresa.
                                        Nossa arquitetura une <strong>IA Generativa de Autoria</strong> com <strong>Compliance de Marca</strong>, permitindo
                                        que empresas escalem sua presença digital mantendo 100% de fidelidade à identidade visual e editorial.
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <Tile>
                                        <Stack gap={2}>
                                            <IbmGranite size={24} />
                                            <p className="cds--type-productive-heading-02">Agentes Especializados</p>
                                            <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                                                Motores treinados em design, redação e análise de dados para resultados superiores.
                                            </p>
                                        </Stack>
                                    </Tile>
                                    <Tile>
                                        <Stack gap={2}>
                                            <DocumentSigned size={24} />
                                            <p className="cds--type-productive-heading-02">Fluxo de Aprovação</p>
                                            <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                                                Governança integrada que evita alucinações de IA e garante segurança jurídica.
                                            </p>
                                        </Stack>
                                    </Tile>
                                    <Tile>
                                        <Stack gap={2}>
                                            <CheckmarkFilled size={24} />
                                            <p className="cds--type-productive-heading-02">Multitenancy Nativo</p>
                                            <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                                                Gerencie múltiplos clientes e marcas com isolamento total de dados via RLS.
                                            </p>
                                        </Stack>
                                    </Tile>
                                    <Tile>
                                        <Stack gap={2}>
                                            <Renew size={24} />
                                            <p className="cds--type-productive-heading-02">Pipeline Autônomo</p>
                                            <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-secondary)' }}>
                                                Do briefing à publicação — tudo em loop contínuo, sem intervenção manual.
                                            </p>
                                        </Stack>
                                    </Tile>
                                </div>

                                {changelog && (
                                    <Tile>
                                        <Stack gap={2}>
                                            <Stack orientation="horizontal" gap={2}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cds-interactive)', marginTop: 6 }} />
                                                <p className="cds--type-productive-heading-02">Últimas Atualizações ({changelog.date})</p>
                                            </Stack>
                                            <p className="cds--type-body-short-01" style={{ whiteSpace: 'pre-line', color: 'var(--cds-text-secondary)' }}>
                                                {changelog.notes}
                                            </p>
                                        </Stack>
                                    </Tile>
                                )}

                                <div style={{ borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '1rem' }}>
                                    <p className="cds--type-helper-text-01" style={{ color: 'var(--cds-text-helper)' }}>
                                        © {new Date().getFullYear()} Cestari Studio. Desenvolvido para marcas que buscam o futuro hoje. Todos os direitos reservados.
                                    </p>
                                </div>
                            </Stack>
                        </TabPanel>

                        {/* ── Content Factory ───────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <Stack orientation="horizontal" gap={3}>
                                    <DataView size={32} />
                                    <div>
                                        <p className="cds--type-productive-heading-04" style={{ textAlign: 'left', marginBottom: '0.5rem' }}>Content Factory</p>
                                        <Tag type="blue" renderIcon={IbmGranite}>Helian {SYSTEM_VERSIONS.helianAI} AI Agent</Tag>
                                    </div>
                                </Stack>
                                <p className="cds--type-body-long-01">
                                    O motor central de geração de conteúdo inteligente. Combina o Brand DNA da sua empresa com limites de caractere por formato para produzir copies de alta performance para Instagram, Facebook, Stories e Reels.
                                </p>
                                <StructuredListWrapper>
                                    <StructuredListBody>
                                        {[
                                            ['Formatos suportados', 'Feed, Carrossel (até 10 cards), Stories, Reels (roteiro)'],
                                            ['Motor de IA', 'Gemini 2.0 Flash / Pro (configurável por tenant)'],
                                            ['Custo estimado', 'Visualizado antes de cada geração em tempo real'],
                                            ['Auditoria', 'Brand Voice Score + Char Limits Ok + Fixed Hashtags'],
                                            ['Mídia', 'Upload, renomeação automática e atribuição por card'],
                                            ['Exportação', 'ZIP com CSV de copies + mídias do post'],
                                            ['Aprovação', 'Status workflow: Rascunho → Em revisão → Aprovado → Publicado'],
                                        ].map(([label, value]) => (
                                            <StructuredListRow key={label}>
                                                <StructuredListCell noWrap>{label}</StructuredListCell>
                                                <StructuredListCell>{value}</StructuredListCell>
                                            </StructuredListRow>
                                        ))}
                                    </StructuredListBody>
                                </StructuredListWrapper>
                                <Button kind="primary" renderIcon={ArrowRight} onClick={() => { setIsAboutModalOpen(false); navigate('/content-factory'); }}>
                                    Abrir Content Factory
                                </Button>
                            </Stack>
                        </TabPanel>

                        {/* ── Brand DNA ─────────────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <Stack orientation="horizontal" gap={3}>
                                    <Cognitive size={32} />
                                    <div>
                                        <p className="cds--type-productive-heading-04">Brand DNA</p>
                                        <Tag type="purple">Identidade de Marca</Tag>
                                    </div>
                                </Stack>
                                <p className="cds--type-body-long-01">
                                    O Brand DNA é o núcleo de inteligência da sua marca no genOS. É o conjunto de regras, pilares editoriais, tom de voz, hashtags fixas e limites de caractere que orientam todos os agentes de IA.
                                </p>
                                <StructuredListWrapper>
                                    <StructuredListBody>
                                        {[
                                            ['Tom de voz', 'Configuração de persona e estilo editorial'],
                                            ['Pilares editoriais', 'Temas prioritários e direcionamentos de conteúdo'],
                                            ['Hashtags fixas', 'Tags obrigatórias inseridas em todos os posts automaticamente'],
                                            ['Limites de caractere', 'Por formato: título, parágrafo, legenda, card e script'],
                                            ['Regras de conteúdo', 'Palavras proibidas, CTA padrão e rodapé fixo'],
                                            ['Compliance', 'Regras jurídicas e restrições aplicadas antes da publicação'],
                                        ].map(([label, value]) => (
                                            <StructuredListRow key={label}>
                                                <StructuredListCell noWrap>{label}</StructuredListCell>
                                                <StructuredListCell>{value}</StructuredListCell>
                                            </StructuredListRow>
                                        ))}
                                    </StructuredListBody>
                                </StructuredListWrapper>
                                <Button kind="primary" renderIcon={ArrowRight} onClick={() => { setIsAboutModalOpen(false); navigate('/brand-dna'); }}>
                                    Configurar Brand DNA
                                </Button>
                            </Stack>
                        </TabPanel>

                        {/* ── Scheduler ─────────────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <Stack orientation="horizontal" gap={3}>
                                    <CalendarHeatMap size={32} />
                                    <div>
                                        <p className="cds--type-productive-heading-04">Scheduler — Calendário Editorial</p>
                                        <Tag type="green">Pipeline de Publicação</Tag>
                                    </div>
                                </Stack>
                                <p className="cds--type-body-long-01">
                                    Visualize toda a sua agenda editorial em um calendário mensal. Programe posts para datas específicas e gerencie o pipeline de aprovação diretamente pelo painel lateral de cada dia.
                                </p>
                                <StructuredListWrapper>
                                    <StructuredListBody>
                                        {[
                                            ['Visão', 'Calendário mensal com navegação entre meses'],
                                            ['Por dia', 'SidePanel com todos os posts agendados, status e plataforma'],
                                            ['Status visual', 'Tags coloridas por status: Rascunho, Em revisão, Aprovado, Publicado'],
                                            ['Overflow', '"+N mais" para dias com muitos posts'],
                                            ['Integração', 'Conectado ao Content Factory — posts criados aparecem automaticamente'],
                                            ['Plano necessário', 'Agendamento automático disponível a partir do Plano Growth'],
                                        ].map(([label, value]) => (
                                            <StructuredListRow key={label}>
                                                <StructuredListCell noWrap>{label}</StructuredListCell>
                                                <StructuredListCell>{value}</StructuredListCell>
                                            </StructuredListRow>
                                        ))}
                                    </StructuredListBody>
                                </StructuredListWrapper>
                                <Button kind="primary" renderIcon={ArrowRight} onClick={() => { setIsAboutModalOpen(false); navigate('/schedule'); }}>
                                    Ver Calendário
                                </Button>
                            </Stack>
                        </TabPanel>

                        {/* ── Analytics ─────────────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <Stack orientation="horizontal" gap={3}>
                                    <DataAnalytics size={32} />
                                    <div>
                                        <p className="cds--type-productive-heading-04">Analytics Dashboard</p>
                                        <Tag type="teal">Inteligência de Dados</Tag>
                                    </div>
                                </Stack>
                                <p className="cds--type-body-long-01">
                                    Painel de análise de desempenho e consumo da plataforma. Acompanhe métricas de geração, uso de tokens, custo por formato e evolução do pipeline de conteúdo ao longo do tempo.
                                </p>
                                <StructuredListWrapper>
                                    <StructuredListBody>
                                        {[
                                            ['Tokens consumidos', 'Histórico de uso e projeção de consumo'],
                                            ['Posts por formato', 'Distribuição de Feed, Carrossel, Stories e Reels'],
                                            ['Custo por operação', 'Breakdown de geração, revisão e reformatação'],
                                            ['Pipeline', 'Funil de status: gerado → revisão → aprovado → publicado'],
                                            ['Tendências', 'Gráfico de linha com evolução diária e semanal'],
                                            ['Export', 'Exportação de dados em formato CSV'],
                                        ].map(([label, value]) => (
                                            <StructuredListRow key={label}>
                                                <StructuredListCell noWrap>{label}</StructuredListCell>
                                                <StructuredListCell>{value}</StructuredListCell>
                                            </StructuredListRow>
                                        ))}
                                    </StructuredListBody>
                                </StructuredListWrapper>
                                <Button kind="primary" renderIcon={ArrowRight} onClick={() => { setIsAboutModalOpen(false); navigate('/analytics'); }}>
                                    Ver Analytics
                                </Button>
                            </Stack>
                        </TabPanel>

                        {/* ── Quality Gate ──────────────────────────────────────── */}
                        <TabPanel>
                            <Stack gap={5} style={{ padding: '1.5rem 0' }}>
                                <Stack orientation="horizontal" gap={3}>
                                    <AiObservability size={32} />
                                    <div>
                                        <p className="cds--type-productive-heading-04">Quality Gate</p>
                                        <Tag type="red">AI Compliance</Tag>
                                    </div>
                                </Stack>
                                <p className="cds--type-body-long-01">
                                    Motor de avaliação automática de qualidade e compliance. Cada post é analisado por critérios de Brand Voice, clareza, adequação jurídica e alinhamento editorial antes de ser publicado.
                                </p>
                                <StructuredListWrapper>
                                    <StructuredListBody>
                                        {[
                                            ['Brand Voice Score', 'Pontuação de 0-100 de alinhamento com o DNA da marca'],
                                            ['Char Limits', 'Verificação automática de limites por formato'],
                                            ['Hashtags', 'Confirmação de inserção das tags fixas'],
                                            ['AI Tone Evaluation', 'Avaliação de tom, clareza e adequação ao pilar editorial'],
                                            ['Compliance Rules', 'Checagem de regras jurídicas e palavras proibidas'],
                                            ['Ação corretiva', 'Botão "Analisar com IA" para revisão automática'],
                                        ].map(([label, value]) => (
                                            <StructuredListRow key={label}>
                                                <StructuredListCell noWrap>{label}</StructuredListCell>
                                                <StructuredListCell>{value}</StructuredListCell>
                                            </StructuredListRow>
                                        ))}
                                    </StructuredListBody>
                                </StructuredListWrapper>
                                <Button kind="primary" renderIcon={ArrowRight} onClick={() => { setIsAboutModalOpen(false); navigate('/quality-gate'); }}>
                                    Ver Quality Gate
                                </Button>
                            </Stack>
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Modal>
        </div>
    );
}
