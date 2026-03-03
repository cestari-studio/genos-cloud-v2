import React, { useEffect, useState } from 'react';
import {
    ComposedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    InlineNotification,
    SkeletonPlaceholder
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
    // ... rest of the state ...
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
                    <div className="flex items-center gap-2 text-[#da1e28]">
                        <WarningFilled size={24} />
                        {reasonTitle}
                    </div>
                }
            />
            <ModalBody>
                <p className="mb-4 text-[14px] text-gray-300">
                    {data?.message || 'Você não possui saldo ou limite suficiente para realizar esta operação de IA.'}
                </p>

                <div className="flex gap-4 mb-6">
                    <div className="bg-[#262626] p-4 flex-1 rounded border border-[#393939]">
                        <div className="text-xs text-gray-400 mb-1">Tokens Restantes</div>
                        <div className={`text-2xl font-bold ${data?.tokens_remaining <= 0 ? 'text-[#da1e28]' : 'text-gray-100'}`}>
                            {data?.tokens_remaining || 0}
                        </div>
                    </div>
                    <div className="bg-[#262626] p-4 flex-1 rounded border border-[#393939]">
                        <div className="text-xs text-gray-400 mb-1">Posts Disponíveis</div>
                        <div className={`text-2xl font-bold ${data?.posts_remaining <= 0 ? 'text-[#da1e28]' : 'text-gray-100'}`}>
                            {data?.posts_remaining || 0}
                        </div>
                    </div>
                </div>

                <h4 className="text-[16px] font-semibold mb-3">Pacotes Adicionais Disponíveis</h4>

                {successMsg && (
                    <InlineNotification
                        kind="success"
                        title="Sucesso"
                        subtitle={successMsg}
                        lowContrast
                        className="mb-4"
                    />
                )}

                {loadingPackages ? (
                    <SkeletonPlaceholder className="w-full h-32" />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {packages.map(pkg => (
                            <div key={pkg.id} className="bg-[#161616] p-4 border border-[#393939] hover:border-[#0f62fe] transition-colors rounded flex flex-col justify-between">
                                <div>
                                    <div className="font-semibold text-[14px] mb-1">{pkg.name}</div>
                                    <div className="text-xs text-gray-400 mb-3">{pkg.description}</div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span>Tokens:</span> <strong className="text-blue-400">+{pkg.token_amount}</strong>
                                    </div>
                                    <div className="flex justify-between text-xs mb-4">
                                        <span>Posts:</span> <strong className="text-green-400">+{pkg.post_amount}</strong>
                                    </div>
                                </div>

                                <Button
                                    size="sm"
                                    kind="primary"
                                    className="w-full"
                                    disabled={requestingId !== null}
                                    onClick={() => handleRequestPurchase(pkg)}
                                >
                                    {requestingId === pkg.id ? 'Solicitando...' : `Solicitar por R$ ${Number(pkg.price_brl).toFixed(2).replace('.', ',')}`}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {packages.length === 0 && !loadingPackages && (
                    <div className="text-sm text-gray-400">Nenhum pacote disponível no momento. Contate o suporte.</div>
                )}

            </ModalBody>
            <ModalFooter>
                <Button kind="secondary" onClick={() => setIsOpen(false)}>
                    Entendi, fechar
                </Button>
            </ModalFooter>
        </ComposedModal>
    );
};
