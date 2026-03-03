import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Modal, AILabel, AILabelContent, AILabelActions } from '@carbon/react';
import {
    ArrowRight
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

    return (
        <div className="console-dashboard">
            {/* ─── Full Viewport Video Background ───────────────────────────── */}
            <video className="console-video-bg" autoPlay muted loop playsInline aria-hidden="true">
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

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

            {/* ─── Modal Sobre ──────────────────────────────────────────────── */}
            <Modal
                open={isAboutModalOpen}
                onRequestClose={() => setIsAboutModalOpen(false)}
                passiveModal
                modalHeading="genOS™ Cloud Platform"
                modalLabel={`Versão ${version}`}
                size="md"
                decorator={
                    <AILabel autoAlign>
                        <AILabelContent>
                            <p>
                                <strong>IA de Autoria & Governança</strong><br />
                                O genOS™ utiliza redes neurais proprietárias treinadas especificamente para cada marca,
                                garantindo que toda geração respeite o tom de voz e as diretrizes de compliance em tempo real.
                            </p>
                        </AILabelContent>
                    </AILabel>
                }
            >
                <div style={{ padding: '0 1rem 2rem 0' }}>
                    <h4 style={{ marginBottom: '1rem', color: '#f4f4f4' }}>A Nova Fronteira da Inteligência de Marca</h4>
                    <p style={{ marginBottom: '1.5rem', lineHeight: 1.6, color: '#c6c6c6' }}>
                        O genOS™ Cloud Platform não é apenas uma ferramenta de IA, é o sistema operacional da comunicação da sua empresa. <br /><br />
                        Nossa arquitetura foi desenhada para unir o poder da **IA Generativa de Autoria** com o rigor do **Compliance de Marca**.
                        Através de nossos agentes autônomos e do motor de análise de DNA, permitimos que empresas escalem sua presença digital
                        mantendo 100% de fidelidade à sua identidade visual e editorial.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderLeft: '2px solid #0f62fe' }}>
                            <h5 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Agentes Especializados</h5>
                            <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>Motores treinados em design, redação e análise de dados para resultados superiores.</p>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderLeft: '2px solid #24a148' }}>
                            <h5 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Fluxo de Aprovação</h5>
                            <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>Governança integrada que evita alucinações de IA e garante segurança jurídica.</p>
                        </div>
                    </div>

                    {changelog && (
                        <div style={{ background: '#262626', padding: '1.25rem', borderRadius: '4px', marginBottom: '2rem', border: '1px solid #393939' }}>
                            <h5 style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f62fe' }} />
                                Últimas Atualizações ({changelog.date})
                            </h5>
                            <p style={{ whiteSpace: 'pre-line', fontSize: '0.875rem', color: '#c6c6c6', lineHeight: 1.5 }}>{changelog.notes}</p>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid #393939', paddingTop: '1.5rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>
                            &copy; {new Date().getFullYear()} Cestari Studio. Desenvolvido para marcas que buscam o futuro hoje. <br />
                            Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
