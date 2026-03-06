import React, { useEffect, useState } from 'react';
import {
    ComposedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    InlineNotification,
    SkeletonPlaceholder,
    Tag,
    Grid,
    Column,
    Stack,
    Tile,
    AILabel,
    AILabelContent,
    Layer
} from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AddonPackage {
    id: string;
    name: string;
    description: string;
    token_amount: number;
    post_amount: number;
    price_brl: number;
}

export const HardBlockModal: React.FC = () => {
    const { me } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<any>(null);

    const [packages, setPackages] = useState<AddonPackage[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [requestingId, setRequestingId] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        const handleHardBlock = (e: Event) => {
            const customEvent = e as CustomEvent;
            setData(customEvent.detail);
            setIsOpen(true);
            fetchPackages();
        };

        window.addEventListener('hard-block', handleHardBlock);
        return () => window.removeEventListener('hard-block', handleHardBlock);
    }, []);

    const fetchPackages = async () => {
        setLoadingPackages(true);
        try {
            const res = await api.edgeFn<{ success: boolean; data: AddonPackage[] }>('addon-manager', {
                action: 'list_packages'
            });
            if (res.success) {
                setPackages(res.data);
            }
        } catch (err) {
            console.error('Failed to load packages', err);
        } finally {
            setLoadingPackages(false);
        }
    };

    const handleRequestPurchase = async (pkg: AddonPackage) => {
        if (!me?.tenant) return;
        setRequestingId(pkg.id);
        setSuccessMsg('');
        try {
            await api.edgeFn('addon-manager', {
                action: 'request_purchase',
                tenantId: me.tenant.id,
                packageId: pkg.id
            });
            setSuccessMsg(`Pedido de ${pkg.name} enviado para aprovação!`);
        } catch (err: any) {
            alert(err.message || 'Erro ao solicitar pacote');
        } finally {
            setRequestingId(null);
        }
    };

    if (!isOpen) return null;

    const isTokens = data?.reason === 'tokens_exhausted';
    const reasonTitle = isTokens ? 'Saldo de Tokens Esgotado' : 'Limite de Posts Atingido';

    return (
        <ComposedModal open={isOpen} onClose={() => setIsOpen(false)} preventCloseOnClickOutside>
            <ModalHeader
                title={
                    <Stack orientation="horizontal" gap={3}>
                        <WarningFilled size={24} />
                        <Tag type="red">{reasonTitle}</Tag>
                    </Stack>
                }
            />
            <ModalBody>
                <Stack gap={5}>
                    <p className="cds--type-body-short-01">
                        {data?.message || 'Você não possui saldo ou limite suficiente para realizar esta operação de IA.'}
                    </p>

                    {/* Metering stats with AILabel */}
                    <div className="hard-block-metering">
                        <Stack orientation="horizontal" gap={3}>
                            <span className="cds--type-label-01">Metering de Consumo</span>
                            <AILabel autoAlign>
                                <AILabelContent>
                                    <p>Hard-block impede gerações com saldo zero até compra de addon. O sistema verifica tokens e post-slots antes de cada operação de IA.</p>
                                </AILabelContent>
                            </AILabel>
                        </Stack>
                    </div>

                    <Grid narrow>
                        <Column sm={4} md={4} lg={8}>
                            <Tile>
                                <Stack gap={2}>
                                    <span className="cds--type-helper-text-01">Tokens Restantes</span>
                                    <Stack orientation="horizontal" gap={2}>
                                        <span className="cds--type-productive-heading-05">
                                            {data?.tokens_remaining || 0}
                                        </span>
                                        {(data?.tokens_remaining ?? 0) <= 0 && (
                                            <Tag type="red" size="sm">Esgotado</Tag>
                                        )}
                                    </Stack>
                                </Stack>
                            </Tile>
                        </Column>
                        <Column sm={4} md={4} lg={8}>
                            <Tile>
                                <Stack gap={2}>
                                    <span className="cds--type-helper-text-01">Posts Disponíveis</span>
                                    <Stack orientation="horizontal" gap={2}>
                                        <span className="cds--type-productive-heading-05">
                                            {data?.posts_remaining || 0}
                                        </span>
                                        {(data?.posts_remaining ?? 0) <= 0 && (
                                            <Tag type="red" size="sm">Esgotado</Tag>
                                        )}
                                    </Stack>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>

                    <h4 className="cds--type-productive-heading-03">Pacotes Adicionais Disponíveis</h4>

                    {successMsg && (
                        <InlineNotification
                            kind="success"
                            title="Sucesso"
                            subtitle={successMsg}
                            lowContrast
                        />
                    )}

                    {loadingPackages ? (
                        <SkeletonPlaceholder style={{ width: '100%', height: '8rem' }} />
                    ) : (
                        <Layer>
                            <Grid narrow>
                                {packages.map(pkg => (
                                    <Column sm={4} md={4} lg={8} key={pkg.id}>
                                        <Tile className="hard-block-card">
                                            <Stack gap={4}>
                                                <Stack gap={1}>
                                                    <span className="cds--type-productive-heading-02">{pkg.name}</span>
                                                    <span className="cds--type-helper-text-01">{pkg.description}</span>
                                                </Stack>
                                                <Stack gap={1}>
                                                    <Stack orientation="horizontal" gap={3}>
                                                        <span className="cds--type-label-01">Tokens:</span>
                                                        <Tag type="blue" size="sm">+{pkg.token_amount}</Tag>
                                                    </Stack>
                                                    <Stack orientation="horizontal" gap={3}>
                                                        <span className="cds--type-label-01">Posts:</span>
                                                        <Tag type="green" size="sm">+{pkg.post_amount}</Tag>
                                                    </Stack>
                                                </Stack>
                                                <Button
                                                    size="sm"
                                                    kind="primary"
                                                    style={{ width: '100%' }}
                                                    disabled={requestingId !== null}
                                                    onClick={() => handleRequestPurchase(pkg)}
                                                >
                                                    {requestingId === pkg.id ? 'Solicitando...' : `Solicitar por R$ ${Number(pkg.price_brl).toFixed(2).replace('.', ',')}`}
                                                </Button>
                                            </Stack>
                                        </Tile>
                                    </Column>
                                ))}
                            </Grid>
                        </Layer>
                    )}

                    {packages.length === 0 && !loadingPackages && (
                        <p className="cds--type-body-short-01">Nenhum pacote disponível no momento. Contate o suporte.</p>
                    )}
                </Stack>
            </ModalBody>
            <ModalFooter>
                <Button kind="secondary" onClick={() => setIsOpen(false)}>
                    Entendi, fechar
                </Button>
            </ModalFooter>
        </ComposedModal>
    );
};
