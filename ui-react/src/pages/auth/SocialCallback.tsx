import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Loading,
    InlineNotification,
    Tile,
    Modal,
    RadioButtonGroup,
    RadioButton,
    Stack,
    Button
} from '@carbon/react';
import { api } from '../../services/api';
import { useNotifications } from '../../components/NotificationProvider';

export default function SocialCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pages, setPages] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPage, setSelectedPage] = useState<string | null>(null);

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (!code || !state) {
                setError('Parâmetros de callback inválidos.');
                setLoading(false);
                return;
            }

            try {
                const stateData = JSON.parse(atob(state));
                const res = await api.edgeFn<any>('meta-oauth', {
                    action: 'exchange_code',
                    code,
                    state,
                    provider: stateData.provider
                });

                if (stateData.provider === 'facebook' && res.pages) {
                    setPages(res.pages);
                    setIsModalOpen(true);
                    setLoading(false);
                } else {
                    showToast('Sucesso', 'Conta conectada com sucesso!', 'success');
                    navigate('/content-factory/settings?tab=social&status=success');
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao processar autenticação Meta.');
                setLoading(false);
            }
        };

        processCallback();
    }, [searchParams, navigate]);

    const handleSelectPage = async () => {
        if (!selectedPage) return;
        const page = pages.find(p => p.id === selectedPage);
        const state = searchParams.get('state');
        const stateData = JSON.parse(atob(state!));

        try {
            await api.edgeFn('meta-oauth', {
                action: 'select_page',
                tenant_id: stateData.tenant_id,
                page_id: page.id,
                page_name: page.name,
                page_token: page.access_token
            });
            showToast('Sucesso', 'Página vinculada com sucesso!', 'success');
            navigate('/content-factory/settings?tab=social&status=success');
        } catch (err: any) {
            showToast('Erro ao vincular página', err.message, 'error');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#161616' }}>
            <Tile style={{ width: '400px', textAlign: 'center', padding: '2rem' }}>
                {loading && (
                    <Stack gap={4}>
                        <Loading withOverlay={false} />
                        <p>Validando credenciais com o Meta...</p>
                    </Stack>
                )}

                {error && (
                    <Stack gap={4}>
                        <InlineNotification
                            kind="error"
                            title="Erro de Autenticação"
                            subtitle={error}
                            hideCloseButton
                        />
                        <Button kind="ghost" onClick={() => navigate('/content-factory/settings')}>
                            Voltar para Configurações
                        </Button>
                    </Stack>
                )}
            </Tile>

            <Modal
                open={isModalOpen}
                modalHeading="Selecione sua Página do Facebook"
                primaryButtonText="Conectar Página"
                secondaryButtonText="Cancelar"
                onRequestClose={() => navigate('/content-factory/settings')}
                onRequestSubmit={handleSelectPage}
                primaryButtonDisabled={!selectedPage}
            >
                <p style={{ marginBottom: '1.5rem' }}>
                    Selecione a página que você deseja utilizar para as publicações automatizadas do genOS.
                </p>
                <RadioButtonGroup
                    name="fb-page-selector"
                    orientation="vertical"
                    onChange={(val) => setSelectedPage(val as string)}
                >
                    {pages.map(page => (
                        <RadioButton
                            key={page.id}
                            id={page.id}
                            labelText={page.name}
                            value={page.id}
                        />
                    ))}
                </RadioButtonGroup>
            </Modal>
        </div>
    );
}
