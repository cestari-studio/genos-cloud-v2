import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../components/LocaleSelectorModal';
import {
    Grid,
    Column,
    ClickableTile,
} from '@carbon/react';
import {
    DataEnrichment,
    Chemistry,
    Search,
    Certificate,
    Settings,
    ArrowRight,
} from '@carbon/icons-react';

interface FeatureCard {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    path: string;
    color: string;
}

const CARDS: FeatureCard[] = [
    {
        id: 'posts',
        icon: <DataEnrichment size={32} />,
        title: 'Posts',
        description: 'Crie, gerencie e publique conteúdo multicanal com assistência de IA.',
        path: '/content-factory',
        color: '#0f62fe',
    },
    {
        id: 'brand-dna',
        icon: <Chemistry size={32} />,
        title: 'Brand DNA',
        description: 'Defina o tom de voz, pilares e identidade de marca que guiam toda a IA.',
        path: '/brand-dna',
        color: '#8a3ffc',
    },
    {
        id: 'semantic',
        icon: <Search size={32} />,
        title: 'Semantic Map',
        description: 'Visualize a rede semântica de palavras-chave e temas da sua marca.',
        path: '/brand-dna/semantic',
        color: '#005d5d',
    },
    {
        id: 'audit',
        icon: <Certificate size={32} />,
        title: 'Compliance Auditor',
        description: 'Valide cada post contra as políticas de conformidade antes de publicar.',
        path: '/factory/audit',
        color: '#da1e28',
    },
    {
        id: 'settings',
        icon: <Settings size={32} />,
        title: 'Configurações',
        description: 'Personalize limites, integrações e preferências do Content Factory.',
        path: '/settings',
        color: '#6f6f6f',
    },
];

export default function Console() {
    const navigate = useNavigate();
    const { me } = useAuth();
    const isClient = (me.tenant?.depth_level ?? 0) >= 2;

    const visibleCards = isClient ? CARDS.filter(c => c.id !== 'settings') : CARDS;

    const userName = me.user?.email?.split('@')[0] || 'usuário';
    // Capitalize first letter
    const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

    return (
        <div className="console-dashboard">
            {/* ─── Video Background ─────────────────────────────────────────── */}
            <video
                className="console-video-bg"
                autoPlay
                muted
                loop
                playsInline
                aria-hidden="true"
            >
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

            {/* ─── Dashboard Content ────────────────────────────────────────── */}
            <div className="console-content">
                {/* User name */}
                <div className="console-greeting">
                    <h1 className="console-greeting-title">
                        Olá, <span className="console-greeting-name">{displayName}</span>
                    </h1>
                    <p className="console-greeting-subtitle">
                        Bem-vindo ao <strong>Content Factory</strong> — gerencie todo o conteúdo da {me.tenant?.name || 'sua marca'} com IA.
                    </p>
                </div>

                {/* 350px spacer */}
                <div style={{ height: 350 }} aria-hidden="true" />

                {/* Card Carousel */}
                <div className="console-carousel-section">
                    <p className="console-carousel-label cds--label">Recursos do Content Factory</p>
                    <div className="console-carousel-track">
                        {visibleCards.map(card => (
                            <ClickableTile
                                key={card.id}
                                className="console-feature-card"
                                onClick={() => navigate(card.path)}
                                renderIcon={ArrowRight}
                            >
                                <div
                                    className="console-feature-card-icon"
                                    style={{ color: card.color }}
                                >
                                    {card.icon}
                                </div>
                                <h4 className="console-feature-card-title cds--productive-heading-02">
                                    {card.title}
                                </h4>
                                <p className="console-feature-card-desc cds--body-short-01">
                                    {card.description}
                                </p>
                            </ClickableTile>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
