import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight } from '@carbon/icons-react';

// IBM.com c4d components are registered globally in App.tsx / vite.config.ts
import '@carbon/ibmdotcom-web-components/es/components/card-section-carousel/index.js';

// Carbon Pictograms
import Desktop from '@carbon/pictograms-react/es/desktop/index.js';
import Dna from '@carbon/pictograms-react/es/dna/index.js';
import Pattern from '@carbon/pictograms-react/es/pattern/index.js';
import AuditTrail from '@carbon/pictograms-react/es/audit-trail/index.js';
import ResetSettings from '@carbon/pictograms-react/es/reset--settings/index.js';

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
        icon: <Desktop aria-label="Posts" className="console-pictogram" />,
        eyebrow: 'Conteúdo',
        title: 'Posts',
        copy: 'Crie, gerencie e publique conteúdo multicanal com assistência de IA do início ao fim.',
        path: '/content-factory',
    },
    {
        id: 'brand-dna',
        icon: <Dna aria-label="Brand DNA" className="console-pictogram" />,
        eyebrow: 'Identidade',
        title: 'Brand DNA',
        copy: 'Defina o tom de voz, pilares e identidade da marca que guiam toda a geração de IA.',
        path: '/content-factory/brand-dna',
    },
    {
        id: 'semantic',
        icon: <Pattern aria-label="Semantic Map" className="console-pictogram" />,
        eyebrow: 'Estratégia',
        title: 'Semantic Map',
        copy: 'Visualize a rede semântica de palavras-chave e temas relevantes para a sua marca.',
        path: '/content-factory/brand-dna/semantic',
    },
    {
        id: 'audit',
        icon: <AuditTrail aria-label="Compliance" className="console-pictogram" />,
        eyebrow: 'Conformidade',
        title: 'Compliance Auditor',
        copy: 'Valide cada post contra as políticas de conformidade antes de publicar.',
        path: '/content-factory/audit',
    },
    {
        id: 'settings',
        icon: <ResetSettings aria-label="Settings" className="console-pictogram" />,
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
            {/* ─── Full Viewport Video Background ───────────────────────────── */}
            <video className="console-video-bg" autoPlay muted loop playsInline aria-hidden="true">
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

            {/* ─── Greeting Overlay (No AI Badges) ──────────────────────────── */}
            <div className="console-greeting-overlay cds--css-grid">
                <div className="cds--css-grid-column cds--col-span-8 cds--col-span-md-6 cds--col-span-sm-4">
                    <h4 className="console-greeting__tenant">Olá, {companyName}</h4>
                    <h4 className="console-greeting__title">genOS™ Cloud Platform</h4>
                    <p className="console-greeting__desc">
                        Dashboard completo da plataforma. Acesse todos os recursos do Content Factory.
                    </p>
                </div>
            </div>

            {/* ─── Carousel Section (Bottom affixed, reaching right edge) ───── */}
            <div className="console-carousel-container">
                {/* 
                  Using actual Carbon for IBM.com c4d-card-section-carousel 
                  which natively goes up to the right edge.
                */}
                <c4d-card-section-carousel>
                    <c4d-content-section-heading>
                        Explore os recursos da plataforma
                    </c4d-content-section-heading>
                    <c4d-content-section-copy>
                        Ferramentas de IA integradas para criar, validar e gerenciar todo o seu conteúdo de marca.
                    </c4d-content-section-copy>
                    <c4d-link-with-icon slot="footer" cta-type="local" href="javascript:void(0)" onClick={() => navigate('/content-factory')}>
                        Ver todos os posts
                    </c4d-link-with-icon>

                    <c4d-carousel>
                        {visibleCards.map((card) => (
                            <c4d-card
                                key={card.id}
                                onClick={(e: any) => { e.preventDefault(); navigate(card.path); }}
                                href="#"
                                className="console-c4d-card"
                            >
                                <div className="console-c4d-card__pictogram">
                                    {card.icon}
                                </div>
                                <c4d-card-eyebrow>{card.eyebrow}</c4d-card-eyebrow>
                                <c4d-card-heading>{card.title}</c4d-card-heading>
                                <c4d-card-copy>{card.copy}</c4d-card-copy>
                                <c4d-card-footer>
                                    <span slot="icon"><ArrowRight size={20} /></span>
                                </c4d-card-footer>
                            </c4d-card>
                        ))}
                    </c4d-carousel>
                </c4d-card-section-carousel>
            </div>
        </div>
    );
}
