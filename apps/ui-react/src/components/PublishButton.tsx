import React, { useState } from 'react';
import { Button, Modal, Checkbox, Stack, Tooltip } from '@carbon/react';
import { Send, Calendar, LogoInstagram, LogoFacebook, Chat } from '@carbon/icons-react';
import { api } from '@/services/api';
import { useNotifications } from '@/components/NotificationProvider';

interface PublishButtonProps {
    postId: string;
    isApproved?: boolean;
}

export default function PublishButton({ postId, isApproved }: PublishButtonProps) {
    const { showToast } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [platforms, setPlatforms] = useState({
        instagram: true,
        facebook: true,
        whatsapp: false
    });

    const handlePublish = async () => {
        setLoading(true);
        try {
            const selected = Object.keys(platforms).filter(p => (platforms as any)[p]);
            await api.edgeFn('social-publisher', {
                action: 'enqueue',
                post_id: postId,
                platforms: selected
            });
            showToast('Sucesso', 'Post enviado para a fila de publicação', 'success');
            setIsOpen(false);
        } catch (err: any) {
            showToast('Erro ao publicar', err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isApproved) return null;

    return (
        <>
            <Button
                kind="primary"
                size="sm"
                renderIcon={Send}
                onClick={() => setIsOpen(true)}
            >
                Publicar
            </Button>

            <Modal
                open={isOpen}
                modalHeading="Publicar nas Redes Sociais"
                primaryButtonText={loading ? "Enviando..." : "Publicar Agora"}
                secondaryButtonText="Cancelar"
                onRequestClose={() => setIsOpen(false)}
                onRequestSubmit={handlePublish}
                primaryButtonDisabled={loading || (!platforms.instagram && !platforms.facebook)}
            >
                <Stack gap={6}>
                    <p>Selecione as plataformas para as quais deseja enviar este conteúdo:</p>

                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={4}>
                            <LogoInstagram size={24} />
                            <Checkbox
                                id="check-ig"
                                labelText="Instagram"
                                checked={platforms.instagram}
                                onChange={(_, { checked }) => setPlatforms(prev => ({ ...prev, instagram: checked }))}
                            />
                        </Stack>

                        <Stack orientation="horizontal" gap={4}>
                            <LogoFacebook size={24} />
                            <Checkbox
                                id="check-fb"
                                labelText="Facebook"
                                checked={platforms.facebook}
                                onChange={(_, { checked }) => setPlatforms(prev => ({ ...prev, facebook: checked }))}
                            />
                        </Stack>

                        <Stack orientation="horizontal" gap={4} className="platform-row--disabled">
                            <Chat size={24} />
                            <Checkbox
                                id="check-wa"
                                labelText="WhatsApp (Em breve)"
                                disabled
                            />
                        </Stack>
                    </Stack>

                    <Button kind="ghost" size="sm" renderIcon={Calendar}>Agendar para Futuro</Button>
                </Stack>
            </Modal>
        </>
    );
}
