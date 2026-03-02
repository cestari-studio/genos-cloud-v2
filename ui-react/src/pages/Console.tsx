import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    DataEnrichment,
    Chemistry,
    Search,
    Certificate,
    Settings as SettingsIcon,
    ArrowRight,
} from '@carbon/icons-react';

// ─── Feature-card data matching c4d-card layout ───────────────────────────────
interface FeatureCard {
    id: string;
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    copy: string;
    path: string;
}

const CARDS: FeatureCard[] = [
    {
        id: 'posts',
        icon: <DataEnrichment size={20} />,
        eyebrow: 'Conteúdo',
        title: 'Posts',
        copy: 'Crie, gerencie e publique conteúdo multicanal com assistência de IA do início ao fim.',
        path: '/content-factory',
    },
    {
        id: 'brand-dna',
        icon: <Chemistry size={20} />,
        eyebrow: 'Identidade',
        title: 'Brand DNA',
        copy: 'Defina o tom de voz, pilares e identidade da marca que guiam toda a geração de IA.',
        path: '/content-factory/brand-dna',
    },
    {
        id: 'semantic',
        icon: <Search size={20} />,
        eyebrow: 'Estratégia',
        title: 'Semantic Map',
        copy: 'Visualize a rede semântica de palavras-chave e temas relevantes para a sua marca.',
        path: '/content-factory/brand-dna/semantic',
    },
    {
        id: 'audit',
        icon: <Certificate size={20} />,
        eyebrow: 'Conformidade',
        title: 'Compliance Auditor',
        copy: 'Valide cada post contra as políticas de conformidade antes de publicar.',
        path: '/content-factory/audit',
    },
    {
        id: 'settings',
        icon: <SettingsIcon size={20} />,
        eyebrow: 'Plataforma',
        title: 'Configurações',
        copy: 'Personalize limites, integrações e preferências do Content Factory.',
        path: '/settings',
    },
];

export default function Console() {
    const navigate = useNavigate();
    const { me } = useAuth();
    const isClient = (me.tenant?.depth_level ?? 0) >= 2;
    const companyName = me.tenant?.name || 'genOS';

    const visibleCards = isClient ? CARDS.filter(c => c.id !== 'settings') : CARDS;

    return (
        <div className="console-dashboard">
            {/* ─── Video Background ─────────────────────────────────────────── */}
            <video className="console-video-bg" autoPlay muted loop playsInline aria-hidden="true">
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

            {/* ─── Dashboard Content ────────────────────────────────────────── */}
            <div className="console-content">
                {/* Greeting */}
                <div className="console-greeting">
                    <h1 className="console-greeting-title">Olá, {companyName}</h1>
                    <p className="console-greeting-subtitle">
                        Bem-vindo ao <strong>Content Factory</strong> — sua plataforma de conteúdo inteligente com IA.
                    </p>
                </div>

                {/* ─── c4d-card-section-carousel layout ─────────────────────── */}
                <div className="csc-section">
                    {/* Left: section heading + copy + footer link */}
                    <div className="csc-section__intro">
                        <p className="csc-section__eyebrow">Content Factory</p>
                        <h2 className="csc-section__heading">Explore os recursos da plataforma</h2>
                        <p className="csc-section__copy">
                            Ferramentas de IA integradas para criar, validar e gerenciar todo o seu conteúdo de marca.
                        </p>
                        <button
                            className="csc-section__footer-link"
                            onClick={() => navigate('/content-factory')}
                        >
                            Ver todos os posts <ArrowRight size={16} />
                        </button>
                    </div>

                    {/* Right: horizontally scrollable carousel of cards */}
                    <div className="csc-carousel" role="region" aria-label="Recursos do Content Factory">
                        {visibleCards.map(card => (
                            <button
                                key={card.id}
                                className="csc-card"
                                onClick={() => navigate(card.path)}
                                aria-label={`Ir para ${card.title}`}
                            >
                                <div className="csc-card__eyebrow">{card.eyebrow}</div>
                                <div className="csc-card__icon">{card.icon}</div>
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
            </div>
        </div>
    );
}
