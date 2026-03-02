import { useState } from 'react';
import { Button, Modal } from '@carbon/react';
import { Renew, Close } from '@carbon/icons-react';
import { useVersion } from '../contexts/VersionContext';

export default function UpdateBanner() {
    const { hasUpdate, latestVersion, dismissUpdate } = useVersion();
    const [modalOpen, setModalOpen] = useState(false);

    if (!hasUpdate || !latestVersion) return null;

    const handleSaibaMais = () => setModalOpen(true);

    const handleClose = () => {
        dismissUpdate();
        setModalOpen(false);
    };

    return (
        <>
            {/* ─── Bottom-right Toast ───────────────────────────────────────── */}
            <div className="update-banner" role="status" aria-live="polite">
                <p className="update-banner__title">
                    <Renew size={16} />
                    Nova versão disponível
                </p>
                <p className="update-banner__body">
                    {latestVersion.title}
                </p>
                <div className="update-banner__actions">
                    <Button kind="primary" size="sm" onClick={handleSaibaMais}>
                        Saiba mais
                    </Button>
                    <Button kind="ghost" size="sm" renderIcon={Close} iconDescription="Fechar" onClick={handleClose}>
                        Dispensar
                    </Button>
                </div>
            </div>

            {/* ─── "Saiba mais" Modal ───────────────────────────────────────── */}
            <Modal
                open={modalOpen}
                onRequestClose={handleClose}
                modalHeading={`Novidades — ${latestVersion.date}`}
                primaryButtonText="Entendido"
                onRequestSubmit={handleClose}
                size="sm"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cds-text-primary)', margin: 0 }}>
                        {latestVersion.title}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {latestVersion.notes}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-helper)', margin: 0 }}>
                        Versão {latestVersion.version}
                    </p>
                </div>
            </Modal>
        </>
    );
}
