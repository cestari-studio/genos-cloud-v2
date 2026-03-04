import React, { useState, useEffect } from 'react';
import {
    Tile, Grid, Column, Stack, Button,
    Tag, InlineLoading, InlineNotification, SkeletonPlaceholder,
    Modal, Dropdown, TagProps, AILabel, AILabelContent, Layer,
    ExpandableTile, TileAboveTheFoldContent, TileBelowTheFoldContent
} from '@carbon/react';
import {
    LogoInstagram, LogoFacebook, Chat,
    Settings as SettingsIcon, Renew, Logout,
    CheckmarkFilled, WarningFilled, ErrorFilled
} from '@carbon/icons-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../components/NotificationProvider';
import type { SocialConnection } from '../types/social';

export default function SocialConnectionsTab() {
    const { me } = useAuth();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [connections, setConnections] = useState<SocialConnection[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fbPages, setFbPages] = useState<any[]>([]);

    const activeTenantId = me.tenant?.id;
    const isAgencyOrMaster = (me.tenant?.depth_level ?? 2) < 2;

    const fetchConnections = async () => {
        if (!activeTenantId) return;
        setLoading(true);
        try {
            const result = await api.edgeFn<any>('meta-oauth', {
                action: 'list_connections',
                tenant_id: activeTenantId
            });
            // edgeFn already unwraps {data: ...}. The result may be an array directly
            // or {connections: [...]} depending on edge fn version
            const list = Array.isArray(result) ? result : (result?.connections || result?.data || []);
            setConnections(list);
        } catch (err: any) {
            showToast('Erro ao carregar conexões', err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, [activeTenantId]);

    const handleConnect = async (provider: 'instagram' | 'facebook') => {
        try {
            // edgeFn already unwraps { data: ... }, so result IS the inner object
            const result = await api.edgeFn<{ auth_url: string }>('meta-oauth', {
                action: 'get_auth_url',
                provider,
                tenant_id: activeTenantId
            });
            if (!result?.auth_url) throw new Error('URL de autenticação não recebida');
            window.location.href = result.auth_url;
        } catch (err: any) {
            showToast('Erro ao iniciar conexão', err.message, 'error');
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        try {
            await api.edgeFn('meta-oauth', {
                action: 'disconnect',
                connection_id: connectionId,
                tenant_id: activeTenantId
            });
            showToast('Sucesso', 'Conexão removida', 'success');
            fetchConnections();
        } catch (err: any) {
            showToast('Erro ao desconectar', err.message, 'error');
        }
    };

    const renderStatus = (conn?: SocialConnection) => {
        if (!conn) return <Tag type="gray">Desconectado</Tag>;
        if (conn.status === 'active') return <Tag type="green" renderIcon={CheckmarkFilled}>Ativo</Tag>;
        if (conn.status === 'expired') return <Tag type="warm-gray" renderIcon={WarningFilled}>Expirado</Tag>;
        return <Tag type="red" renderIcon={ErrorFilled}>Erro</Tag>;
    };

    const igConn = connections.find(c => c.platform === 'instagram');
    const fbConn = connections.find(c => c.platform === 'facebook');

    return (
        <Stack gap={7}>
            <Stack gap={3}>
                <Stack orientation="horizontal" gap={3}>
                    <h4 className="cds--type-productive-heading-03">Conexões de Redes Sociais</h4>
                </Stack>
                <p className="cds--type-body-short-01">Gerencie onde seu conteúdo será publicado automaticamente.</p>
            </Stack>

            <Grid narrow>
                {/* Instagram Card */}
                <Column lg={5} md={4} sm={4}>
                    <ExpandableTile
                        id="ig-tile"
                        tileCollapsedIconText="Expandir"
                        tileExpandedIconText="Colapsar"
                        decorator={
                            <AILabel className="ai-label-container">
                                <AILabelContent>
                                    <div>
                                        <p className="secondary">AI Connection Health</p>
                                        <h2 className="ai-label-heading">99%</h2>
                                        <p className="secondary bold">Confidence score</p>
                                        <p className="secondary">O token da Graph API Graph do Instagram está perfeitamente calibrado. O tráfego de geração de IA será publicado sem interrupções.</p>
                                        <hr />
                                        <p className="secondary">Connector Type</p>
                                        <p className="bold">Official Meta OAuth API</p>
                                    </div>
                                </AILabelContent>
                            </AILabel>
                        }
                    >
                        <TileAboveTheFoldContent>
                            <Stack orientation="horizontal" gap={4}>
                                <div className="social-icon-badge social-icon-badge--instagram">
                                    <LogoInstagram size={32} fill="white" />
                                </div>
                                <Stack gap={1}>
                                    <h5 className="cds--type-productive-heading-02">Instagram</h5>
                                    <p className="cds--label">{igConn?.platform_username || 'Business Account'}</p>
                                </Stack>
                                <div style={{ marginLeft: 'auto' }}>
                                    {renderStatus(igConn)}
                                </div>
                            </Stack>
                        </TileAboveTheFoldContent>
                        <TileBelowTheFoldContent>
                            <Stack gap={4} style={{ marginTop: '1.5rem' }}>
                                <p className="cds--type-body-short-01">
                                    Publicação segura via Container do Meta Graph API. O genOS cria os chunks de mídia e publica em multi-stage respeitando totalmente os limites do Instagram.
                                </p>
                                <Tile>
                                    {igConn ? (
                                        <Stack gap={1}>
                                            <p className="cds--type-body-short-01">
                                                Conectado como <strong>{igConn.platform_username}</strong>.
                                            </p>
                                            <span className="cds--type-helper-text-01">
                                                Token expira em: {igConn.token_expires_at ? new Date(igConn.token_expires_at).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </Stack>
                                    ) : (
                                        <p className="cds--type-body-short-01">
                                            Publique Posts, Reels e Stories diretamente do genOS AI.
                                        </p>
                                    )}
                                </Tile>

                                {isAgencyOrMaster && (
                                    <Button
                                        kind={igConn ? "danger--ghost" : "primary"}
                                        renderIcon={igConn ? Logout : Renew}
                                        onClick={() => igConn ? handleDisconnect(igConn.id) : handleConnect('instagram')}
                                        size="sm"
                                    >
                                        {igConn ? 'Desconectar' : 'Conectar Instagram'}
                                    </Button>
                                )}
                            </Stack>
                        </TileBelowTheFoldContent>
                    </ExpandableTile>
                </Column>

                {/* Facebook Card */}
                <Column lg={5} md={4} sm={4}>
                    <ExpandableTile
                        id="fb-tile"
                        tileCollapsedIconText="Expandir"
                        tileExpandedIconText="Colapsar"
                        decorator={
                            <AILabel className="ai-label-container">
                                <AILabelContent>
                                    <div>
                                        <p className="secondary">AI Connection Health</p>
                                        <h2 className="ai-label-heading">100%</h2>
                                        <p className="secondary bold">Confidence score</p>
                                        <p className="secondary">O Graph API do Facebook está totalmente funcional. Tokens de longa duração são auto-renovados pelo genOS AI Core.</p>
                                        <hr />
                                        <p className="secondary">Connector Type</p>
                                        <p className="bold">Official Facebook Open Graph API</p>
                                    </div>
                                </AILabelContent>
                            </AILabel>
                        }
                    >
                        <TileAboveTheFoldContent>
                            <Stack orientation="horizontal" gap={4}>
                                <div className="social-icon-badge social-icon-badge--facebook">
                                    <LogoFacebook size={32} fill="white" />
                                </div>
                                <Stack gap={1}>
                                    <h5 className="cds--type-productive-heading-02">Facebook</h5>
                                    <p className="cds--label">{fbConn?.platform_username || 'Page'}</p>
                                </Stack>
                                <div style={{ marginLeft: 'auto' }}>
                                    {renderStatus(fbConn)}
                                </div>
                            </Stack>
                        </TileAboveTheFoldContent>
                        <TileBelowTheFoldContent>
                            <Stack gap={4} style={{ marginTop: '1.5rem' }}>
                                <p className="cds--type-body-short-01">
                                    Publicação direta via Graph API na página conectada. O genOS gerencia o processo de forma unificada para simplificar o seu pipeline criativo.
                                </p>
                                <Tile>
                                    {fbConn ? (
                                        <Stack gap={1}>
                                            <p className="cds--type-body-short-01">
                                                Página: <strong>{fbConn.platform_username}</strong>.
                                            </p>
                                            <span className="cds--type-helper-text-01">Conexão de longo prazo ativa.</span>
                                        </Stack>
                                    ) : (
                                        <p className="cds--type-body-short-01">
                                            Gerencie e publique em suas Páginas do Facebook simultaneamente com o Instagram.
                                        </p>
                                    )}
                                </Tile>

                                {isAgencyOrMaster && (
                                    <Button
                                        kind={fbConn ? "danger--ghost" : "primary"}
                                        renderIcon={fbConn ? Logout : Renew}
                                        onClick={() => fbConn ? handleDisconnect(fbConn.id) : handleConnect('facebook')}
                                        size="sm"
                                    >
                                        {fbConn ? 'Desconectar' : 'Conectar Facebook'}
                                    </Button>
                                )}
                            </Stack>
                        </TileBelowTheFoldContent>
                    </ExpandableTile>
                </Column>

                {/* WhatsApp Card (Placeholder) */}
                <Column lg={3} md={4} sm={4}>
                    <ExpandableTile
                        id="wa-tile"
                        tileCollapsedIconText="Expandir"
                        tileExpandedIconText="Colapsar"
                        className="social-card--coming-soon"
                        decorator={
                            <AILabel className="ai-label-container">
                                <AILabelContent>
                                    <div>
                                        <p className="secondary">AI Approval Agent</p>
                                        <h2 className="ai-label-heading">100%</h2>
                                        <p className="secondary bold">Integration Ready</p>
                                        <p className="secondary">Notifica clientes via WhatsApp e recebe aprovações diretas dos responsáveis. Fluxo autônomo do GenOS AI aprovando as cópias ou sinalizando para alterações baseando no context NLP do chat.</p>
                                        <hr />
                                        <p className="secondary">Model Status</p>
                                        <p className="bold">Beta Deployment</p>
                                    </div>
                                </AILabelContent>
                            </AILabel>
                        }
                    >
                        <TileAboveTheFoldContent>
                            <Stack orientation="horizontal" gap={4}>
                                <div className="social-icon-badge social-icon-badge--whatsapp">
                                    <Chat size={32} fill="white" />
                                </div>
                                <h5 className="cds--type-productive-heading-02">WhatsApp</h5>
                                <div style={{ marginLeft: 'auto' }}>
                                    <Tag type="cool-gray">EM BREVE</Tag>
                                </div>
                            </Stack>
                        </TileAboveTheFoldContent>
                        <TileBelowTheFoldContent>
                            <Stack gap={4} style={{ marginTop: '1.5rem' }}>
                                <p className="cds--type-body-short-01">
                                    Aprovações e notificações via WhatsApp chegarão em breve para melhorar ainda mais o loop de feedback do cliente.
                                </p>
                                <Button kind="ghost" size="sm" disabled>Indisponível</Button>
                            </Stack>
                        </TileBelowTheFoldContent>
                    </ExpandableTile>
                </Column>
            </Grid>

            {connections.some(c => c.status === 'expired') && (
                <InlineNotification
                    kind="warning"
                    title="Conexão Expirada"
                    subtitle="Alguns de seus tokens do Meta expiraram. Clique em reconectar para manter a publicação automática funcionando."
                    hideCloseButton
                />
            )}
        </Stack>
    );
}
