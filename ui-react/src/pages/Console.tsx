import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, DataEnrichment, FingerprintRecognition, Group, Recommend, Settings as SettingsIcon } from '@carbon/icons-react';
import { Button, Modal } from '@carbon/react';

interface FeatureCard {
    id: string;
    icon: React.ReactNode;
    title: string;
    copy: string;
    path: string;
}

const CARDS: FeatureCard[] = [
    {
        id: 'posts',
        icon: <DataEnrichment size={24} aria-label="Posts" />,
        title: 'Posts',
        copy: 'Crie, gerencie e publique conteúdo multicanal com assistência de IA do início ao fim.',
        path: '/content-factory/posts',
    },
    {
        id: 'brand-dna',
        icon: <FingerprintRecognition size={24} aria-label="Brand DNA" />,
        title: 'Brand DNA',
        copy: 'Defina o tom de voz, pilares e identidade da marca que guiam toda a geração de IA.',
        path: '/content-factory/brand-dna',
    },
    {
        id: 'semantic',
        icon: <Group size={24} aria-label="Semantic Map" />,
        title: 'Semantic Map',
        copy: 'Visualize a rede semântica de palavras-chave e temas relevantes para a sua marca.',
        path: '/content-factory/brand-dna/semantic',
    },
    {
        id: 'audit',
        icon: <Recommend size={24} aria-label="Compliance" />,
        title: 'Compliance Auditor',
        copy: 'Valide cada post contra as políticas de conformidade antes de publicar.',
        path: '/content-factory/audit',
    },
    {
        id: 'settings',
        icon: <SettingsIcon size={24} aria-label="Settings" />,
        title: 'Configurações',
        copy: 'Personalize limites, integrações e preferências do Content Factory.',
        path: '/content-factory/settings',
    },
];

export default function Console() {
    const navigate = useNavigate();
    const { me } = useAuth();
    const isClient = (me.tenant?.depth_level ?? 0) >= 2;
    const companyName = me.tenant?.name || 'genOS';

    const visibleCards = isClient ? CARDS.filter(c => c.id !== 'settings') : CARDS;

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

            {/* ─── Native React CSS Carousel ────────────────────────────────── */}
            <div className="csc-section">
                <div className="csc-section__intro">
                    <p className="csc-section__heading">Explore os recursos da plataforma</p>
                    <p className="csc-section__copy">
                        Ferramentas de IA integradas para criar, validar e gerenciar todo o seu conteúdo de marca.
                    </p>
                    <button className="csc-section__footer-link" onClick={() => navigate('/content-factory')}>
                        Ver todos os posts <ArrowRight size={16} />
                    </button>
                </div>

                <div className="csc-carousel" role="region" aria-label="Recursos do Content Factory">
                    {visibleCards.map(card => (
                        <button key={card.id} className="csc-card" onClick={() => navigate(card.path)} aria-label={`Ir para ${card.title}`}>
                            <div className="console-c4d-card__pictogram">{card.icon}</div>
                            <h4 className="csc-card__title">{card.title}</h4>
                            <p className="csc-card__copy">{card.copy}</p>
                            <div className="csc-card__cta">
                                <span>Acessar</span>
                                <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}
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
