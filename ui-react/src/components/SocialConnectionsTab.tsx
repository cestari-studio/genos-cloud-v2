import React, { useState, useEffect } from 'react';
import {
    Tile, ClickableTile, Grid, Column, Stack, Button,
    Tag, InlineLoading, InlineNotification, SkeletonPlaceholder,
    Modal, Dropdown, TagProps
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
            const { data } = await api.edgeFn<any>('meta-oauth', {
                action: 'list_connections',
                tenant_id: activeTenantId
            });
            setConnections(data || []);
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
            const { data } = await api.edgeFn<any>('meta-oauth', {
                action: 'get_auth_url',
                provider,
                tenant_id: activeTenantId
            });
            window.location.href = data.auth_url;
        } catch (err: any) {
            showToast('Erro ao iniciar conexão', err.message, 'error');
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        try {
            await api.edgeFn('meta-oauth', { action: 'disconnect', connectionId });
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
        <div style={{ padding: '1rem 0' }}>
            <Stack gap={7}>
                <div>
                    <h4 style={{ marginBottom: '0.5rem' }}>Conexões de Redes Sociais</h4>
                    <p style={{ color: '#c6c6c6' }}>Gerencie onde seu conteúdo será publicado automaticamente.</p>
                </div>

                <Grid narrow>
                    {/* Instagram Card */}
                    <Column lg={5} md={4} sm={4}>
                        <Tile style={{ padding: '1.5rem', minHeight: '260px', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                                {renderStatus(igConn)}
                            </div>
                            <Stack gap={4}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                                        padding: '10px', borderRadius: '8px'
                                    }}>
                                        <LogoInstagram size={32} fill="white" />
                                    </div>
                                    <div>
                                        <h5 className="cds--type-productive-heading-02">Instagram</h5>
                                        <p className="cds--label">{igConn?.platform_username || 'Business Account'}</p>
                                    </div>
                                </div>

                                <div style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                    {igConn ? (
                                        <p style={{ fontSize: '0.875rem' }}>
                                            Conectado como <strong>{igConn.platform_username}</strong>.<br />
                                            <span style={{ color: '#c6c6c6', fontSize: '0.75rem' }}>
                                                Token expira em: {igConn.token_expires_at ? new Date(igConn.token_expires_at).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </p>
                                    ) : (
                                        <p style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>
                                            Publique Posts, Reels e Stories diretamente do genOS.
                                        </p>
                                    )}
                                </div>

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
                        </Tile>
                    </Column>

                    {/* Facebook Card */}
                    <Column lg={5} md={4} sm={4}>
                        <Tile style={{ padding: '1.5rem', minHeight: '260px', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                                {renderStatus(fbConn)}
                            </div>
                            <Stack gap={4}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ backgroundColor: '#1877f2', padding: '10px', borderRadius: '8px' }}>
                                        <LogoFacebook size={32} fill="white" />
                                    </div>
                                    <div>
                                        <h5 className="cds--type-productive-heading-02">Facebook</h5>
                                        <p className="cds--label">{fbConn?.platform_username || 'Page'}</p>
                                    </div>
                                </div>

                                <div style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                    {fbConn ? (
                                        <p style={{ fontSize: '0.875rem' }}>
                                            Página: <strong>{fbConn.platform_username}</strong>.<br />
                                            <span style={{ color: '#c6c6c6', fontSize: '0.75rem' }}>Conexão de longo prazo ativa.</span>
                                        </p>
                                    ) : (
                                        <p style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>
                                            Gerencie e publique em suas Páginas do Facebook.
                                        </p>
                                    )}
                                </div>

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
                        </Tile>
                    </Column>

                    {/* WhatsApp Card (Placeholder) */}
                    <Column lg={3} md={4} sm={4}>
                        <Tile style={{ padding: '1.5rem', minHeight: '260px', borderStyle: 'dashed', opacity: 0.6 }}>
                            <Tag type="cool-gray" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>EM BREVE</Tag>
                            <Stack gap={4}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ backgroundColor: '#25d366', padding: '10px', borderRadius: '8px' }}>
                                        <Chat size={32} fill="white" />
                                    </div>
                                    <div>
                                        <h5 className="cds--type-productive-heading-02">WhatsApp</h5>
                                    </div>
                                </div>
                                <div style={{ height: '80px', display: 'flex', alignItems: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>
                                        Aprovações e notificações via WhatsApp chegarão em breve.
                                    </p>
                                </div>
                                <Button kind="ghost" size="sm" disabled>Indisponível</Button>
                            </Stack>
                        </Tile>
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
        </div>
    );
}
