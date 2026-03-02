import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AILabel, AILabelContent } from '@carbon/react';
import {
    DataEnrichment,
    Chemistry,
    Search,
    Certificate,
    Settings as SettingsIcon,
    ArrowRight,
} from '@carbon/icons-react';
import { t, getLocale } from '../components/LocaleSelectorModal';

// ─── Feature cards (c4d-card-section-carousel layout) ────────────────────────
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
    const usage = me.usage;

    const visibleCards = isClient ? CARDS.filter(c => c.id !== 'settings') : CARDS;

    const tokenPct = usage
        ? Math.min(100, Math.round((usage.tokens_used / Math.max(1, usage.tokens_limit)) * 100))
        : 0;
    const postPct = usage
        ? Math.min(100, Math.round((usage.posts_used / Math.max(1, usage.posts_limit)) * 100))
        : 0;

    return (
        <div className="console-dashboard">
            {/* ─── Video Background ─────────────────────────────────────────── */}
            <video className="console-video-bg" autoPlay muted loop playsInline aria-hidden="true">
                <source src="/dashboard-bg.mp4" type="video/mp4" />
            </video>
            <div className="console-video-overlay" aria-hidden="true" />

            {/* ─── Standard Page Header ─────────────────────────────────────── */}
            <div className="console-page-header">
                {/* Top bar: AI badges left, AI label right */}
                <div className="gen-page-header">
                    <div className="gen-page-header__left">
                        {usage && (
                            <div className="gen-page-header__badges">
                                {/* Tokens badge */}
                                <AILabel autoAlign kind="inline" size="sm"
                                    textLabel={`${usage.tokens_used.toLocaleString(getLocale())} / ${usage.tokens_limit.toLocaleString(getLocale())} tokens`}
                                >
                                    <AILabelContent>
                                        <div className="ai-badge-popover">
                                            <div className="ai-badge-popover__header">
                                                <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                                                <h4 className="ai-badge-popover__title">{t('aiTokensTitle')}</h4>
                                            </div>
                                            <div className="ai-badge-popover__meter-block">
                                                <div className="ai-badge-popover__big-number">{100 - tokenPct}%</div>
                                                <p className="ai-badge-popover__status" data-ok={usage.tokens_used < usage.tokens_limit}>
                                                    {usage.tokens_used < usage.tokens_limit
                                                        ? `${(usage.tokens_limit - usage.tokens_used).toLocaleString(getLocale())} ${t('aiTokensRemaining')}`
                                                        : t('aiTokensLimitReached')}
                                                </p>
                                                <div className="ai-badge-popover__progress-track">
                                                    <div className="ai-badge-popover__progress-fill" style={{ width: `${tokenPct}%` }} />
                                                </div>
                                            </div>
                                            <p className="ai-badge-popover__desc">{t('aiTokensDesc')}</p>
                                            <div className="ai-badge-popover__divider" />
                                            <div className="ai-badge-popover__stats">
                                                <div className="ai-badge-popover__stat">
                                                    <span className="ai-badge-popover__stat-label">{t('aiTokensUsed')}</span>
                                                    <span className="ai-badge-popover__stat-value">{usage.tokens_used.toLocaleString(getLocale())}</span>
                                                </div>
                                                <div className="ai-badge-popover__stat">
                                                    <span className="ai-badge-popover__stat-label">{t('aiCurrentCycle')}</span>
                                                    <span className="ai-badge-popover__stat-value">
                                                        {new Date().toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </AILabelContent>
                                </AILabel>

                                {/* Posts badge */}
                                <AILabel autoAlign kind="inline" size="sm"
                                    textLabel={`${usage.posts_used} / ${usage.posts_limit} posts`}
                                >
                                    <AILabelContent>
                                        <div className="ai-badge-popover">
                                            <div className="ai-badge-popover__header">
                                                <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                                                <h4 className="ai-badge-popover__title">{t('aiPostsTitle')}</h4>
                                            </div>
                                            <div className="ai-badge-popover__meter-block">
                                                <div className="ai-badge-popover__big-number">{100 - postPct}%</div>
                                                <p className="ai-badge-popover__status" data-ok={usage.posts_used < usage.posts_limit}>
                                                    {usage.posts_used < usage.posts_limit
                                                        ? `${usage.posts_limit - usage.posts_used} ${t('aiPostsRemaining')}`
                                                        : t('aiPostsLimitReached')}
                                                </p>
                                                <div className="ai-badge-popover__progress-track">
                                                    <div className="ai-badge-popover__progress-fill" style={{ width: `${postPct}%` }} />
                                                </div>
                                            </div>
                                            <p className="ai-badge-popover__desc">{t('aiPostsDesc')}</p>
                                            <div className="ai-badge-popover__divider" />
                                            <div className="ai-badge-popover__stats">
                                                <div className="ai-badge-popover__stat">
                                                    <span className="ai-badge-popover__stat-label">{t('aiPostsUsed')}</span>
                                                    <span className="ai-badge-popover__stat-value">{usage.posts_used}</span>
                                                </div>
                                                <div className="ai-badge-popover__stat">
                                                    <span className="ai-badge-popover__stat-label">{t('aiCurrentCycle')}</span>
                                                    <span className="ai-badge-popover__stat-value">
                                                        {new Date().toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </AILabelContent>
                                </AILabel>
                            </div>
                        )}
                    </div>
                    <div className="gen-page-header__right">
                        <AILabel autoAlign kind="inline" size="sm">
                            <AILabelContent>
                                <div className="ai-badge-popover" style={{ maxWidth: '22rem' }}>
                                    <div className="ai-badge-popover__header">
                                        <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                                        <h4 className="ai-badge-popover__title">{t('aiContentFactoryTitle')}</h4>
                                    </div>
                                    <p className="ai-badge-popover__desc">{t('aiContentFactoryDesc')}</p>
                                    <div className="ai-badge-popover__divider" />
                                    <p className="ai-badge-popover__features">{t('aiContentFactoryFeatures')}</p>
                                </div>
                            </AILabelContent>
                        </AILabel>
                    </div>
                </div>

                {/* H4 / H4 / P title block */}
                <div className="gen-page-title-block">
                    <h4 className="gen-page-title-block__tenant">Olá, {companyName}</h4>
                    <h4 className="gen-page-title-block__heading">genOS™ Cloud Platform</h4>
                    <p className="gen-page-title-block__desc">
                        Dashboard completo da plataforma. Acesse todos os recursos do Content Factory.
                    </p>
                </div>
            </div>

            {/* ─── Carousel Section ─────────────────────────────────────────── */}
            <div className="console-content">
                <div className="csc-section">
                    <div className="csc-section__intro">
                        <p className="csc-section__eyebrow">Content Factory</p>
                        <h2 className="csc-section__heading">Explore os recursos da plataforma</h2>
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
