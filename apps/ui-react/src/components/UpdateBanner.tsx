import React, { useState } from 'react';
import { ActionableNotification, Modal } from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { useVersion } from '@/shared/contexts/VersionProvider';

export default function UpdateBanner() {
    const { hasUpdate, updateData, dismissUpdate, remoteVersion, currentVersion } = useVersion();
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!hasUpdate || !updateData) return null;

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    zIndex: 9000,
                    animation: 'fade-in 0.4s ease-out',
                }}
            >
                <ActionableNotification
                    kind="info"
                    title="Atualização Disponível"
                    subtitle="Uma nova versão do genOS™ Cloud foi instalada. Recarregue a página para aplicar."
                    caption={updateData.date}
                    onCloseButtonClick={dismissUpdate}
                    actionButtonLabel="Ver Mudanças"
                    onActionButtonClick={() => setIsModalOpen(true)}
                    lowContrast
                />
            </div>

            <Modal
                open={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                modalHeading={`Novidades da Versão ${remoteVersion}`}
                primaryButtonText="Recarregar Agora"
                secondaryButtonText="Mais Tarde"
                onRequestSubmit={() => window.location.reload()}
                size="sm"
            >
                <div style={{ paddingBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#78a9ff' }}>
                        <Information size={20} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{updateData.title}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#c6c6c6', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {updateData.notes}
                    </p>
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#262626', borderRadius: '4px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', margin: 0 }}>
                            Você está na versão <strong style={{ color: '#f4f4f4' }}>{currentVersion}</strong>.
                        </p>
                    </div>
                </div>
            </Modal>

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </>
    );
}
