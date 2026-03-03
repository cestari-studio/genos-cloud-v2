import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Modal } from '@carbon/react';


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

    return (
        <div className="console-dashboard">
            {/* ─── Full Viewport Video Background ───────────────────────────── */}
            <video className="console-video-bg" autoPlay muted loop playsInline aria-hidden="true">
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

            {/* ─── Greeting Overlay (No AI Badges) ──────────────────────────── */}
            <div className="console-greeting-overlay cds--css-grid">
                <div className="cds--css-grid-column cds--col-span-8 cds--col-span-md-6 cds--col-span-sm-4">
                    <h4 className="console-greeting__tenant">Olá {companyName}</h4>
                    <h3 className="console-greeting__title" style={{ fontSize: '2.5rem', fontWeight: 300, marginBottom: '0.5rem' }}>genOS™ Cloud Platform</h3>
                    <p className="console-greeting__desc" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#f4f4f4' }}>
                        v{version}
                        <Button kind="tertiary" size="sm" onClick={() => setIsAboutModalOpen(true)}>
                            Saiba mais
                        </Button>
                    </p>
                </div>
            </div>

            {/* ─── Modal Sobre ──────────────────────────────────────────────── */}
            <Modal
                open={isAboutModalOpen}
                onRequestClose={() => setIsAboutModalOpen(false)}
                passiveModal
                modalHeading={`genOS™ Cloud Platform v${version}`}
            >
                <div style={{ marginTop: '1rem' }}>
                    <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        O genOS™ Cloud Platform é a plataforma proprietária da Cestari Studio de IA Generativa. <br />
                        Criada para redefinir o fluxo de trabalho de marcas, unindo Content Factory e conformidade avançada.
                    </p>

                    {changelog && (
                        <div style={{ background: '#262626', padding: '1rem', borderRadius: '4px', marginBottom: '2rem' }}>
                            <h5 style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#f4f4f4' }}>Notas de Lançamento ({changelog.date})</h5>
                            <p style={{ whiteSpace: 'pre-line', fontSize: '0.875rem', color: '#c6c6c6' }}>{changelog.notes}</p>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid #393939', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>
                            &copy; {new Date().getFullYear()} Cestari Studio. Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
