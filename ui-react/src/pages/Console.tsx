import { Button, Modal } from '@carbon/react';
import {
    ArrowRight,
    Idea,
    Enterprise,
    Analytics,
    Security,
    View
} from '@carbon/icons-react';

const FEATURE_CARDS = [
    {
        eyebrow: 'Autoria',
        title: 'Content Factory',
        copy: 'Gere posts, carrosséis e vídeos com IA treinada no DNA da sua marca.',
        href: '/content-factory',
        pictogram: <Idea size={24} />,
    },
    {
        eyebrow: 'Identidade',
        title: 'Brand DNA',
        copy: 'Configure o tom de voz, pilares editoriais e regras visuais do seu workspace.',
        href: '/content-factory/brand-dna',
        pictogram: <Enterprise size={24} />,
    },
    {
        eyebrow: 'Segurança',
        title: 'Compliance Auditor',
        copy: 'Auditoria em tempo real para garantir que sua comunicação segue as diretrizes da marca.',
        href: '/content-factory/audit',
        pictogram: <Security size={24} />,
    },
    {
        eyebrow: 'Inteligência',
        title: 'Observatory',
        copy: 'Analise o sentimento e a performance da sua marca em todos os canais.',
        href: '/quantum-observability',
        pictogram: <Analytics size={24} />,
    }
];
import {
    ArrowRight,
    Idea,
    Enterprise,
    ChartSearch,
    Security,
    View
} from '@carbon/icons-react';

const FEATURE_CARDS = [
    {
        eyebrow: 'Autoria',
        title: 'Content Factory',
        copy: 'Gere posts, carrosséis e vídeos com IA treinada no DNA da sua marca.',
        href: '/content-factory',
        pictogram: <Idea size={24} />,
    },
    {
        eyebrow: 'Identidade',
        title: 'Brand DNA',
        copy: 'Configure o tom de voz, pilares editoriais e regras visuais do seu workspace.',
        href: '/content-factory/brand-dna',
        pictogram: <Enterprise size={24} />,
    },
    {
        eyebrow: 'Segurança',
        title: 'Compliance Auditor',
        copy: 'Auditoria em tempo real para garantir que sua comunicação segue as diretrizes da marca.',
        href: '/content-factory/audit',
        pictogram: <Security size={24} />,
    },
    {
        eyebrow: 'Inteligência',
        title: 'Observatory',
        copy: 'Analise o sentimento e a performance da sua marca em todos os canais.',
        href: '/quantum-observability',
        pictogram: <Analytics size={24} />,
    }
];


export default function Console() {
    const navigate = useNavigate();
    const { me } = useAuth();
    const companyName = me.tenant?.name || 'genOS';

    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isUsageRefreshing, setIsUsageRefreshing] = useState(false);
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
            <div className="console-greeting-overlay cds--css-grid" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
                <div className="cds--css-grid-column cds--col-span-8 cds--col-span-md-6 cds--col-span-sm-4">
                    <h4 className="console-greeting__tenant">Olá {companyName}</h4>
                    <h3 className="console-greeting-title">genOS™ Cloud Platform</h3>
                    <div className="console-greeting__desc">
                        v{version}
                        <Button kind="tertiary" size="sm" onClick={() => setIsAboutModalOpen(true)} style={{ marginLeft: '1rem' }}>
                            Saiba mais
                        </Button>
                    </div>
                </div>

                {/* ─── Usage Summary Card ─── */}
                <div className="cds--css-grid-column cds--col-span-4 cds--col-span-md-4 cds--col-span-sm-4">
                    <div style={{ backgroundColor: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(20px)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h5 style={{ color: '#c6c6c6', fontSize: '0.875rem', fontWeight: 600 }}>Uso do Período</h5>
                            <Tag type="blue" size="sm">Mensal</Tag>
                        </div>

                        <div className="cds--css-grid" style={{ padding: 0, gap: '1rem' }}>
                            <div className="cds--css-grid-column cds--col-span-2">
                                <div style={{ fontSize: '1.75rem', fontWeight: 300, color: '#fff' }}>{me.usage?.tokens_used?.toLocaleString() || 0}</div>
                                <div style={{ fontSize: '0.75rem', color: '#8d8d8d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tokens</div>
                            </div>
                            <div className="cds--css-grid-column cds--col-span-2">
                                <div style={{ fontSize: '1.75rem', fontWeight: 300, color: '#fff' }}>{me.usage?.posts_used || 0}/{me.usage?.posts_limit || 0}</div>
                                <div style={{ fontSize: '0.75rem', color: '#8d8d8d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                            <Button
                                kind="ghost"
                                size="sm"
                                onClick={() => navigate('/settings')}
                                style={{ color: '#78a9ff', padding: 0 }}
                                renderIcon={ArrowRight}
                            >
                                Gerenciar Plano
                            </Button>
                        </div>
                    </div>
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

function CSCSection({ heading, copy, footerLabel, onFooterClick, cards }: any) {
    return (
        <section className="csc-section">
            <div className="csc-section__intro">
                <h2 className="csc-section__heading">{heading}</h2>
                <p className="csc-section__copy">{copy}</p>
                <button className="csc-section__footer-link" onClick={onFooterClick}>
                    {footerLabel} <ArrowRight />
                </button>
            </div>
            <div className="csc-carousel">
                {cards.map((card: any, idx: number) => (
                    <div key={idx} className="csc-card" onClick={card.onClick}>
                        <p className="csc-card__eyebrow">{card.eyebrow}</p>
                        <div className="console-c4d-card__pictogram">
                            {card.pictogram}
                        </div>
                        <h3 className="csc-card__title">{card.title}</h3>
                        <p className="csc-card__copy">{card.copy}</p>
                        <div className="csc-card__cta">
                            Explorar <ArrowRight />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

const Tag = ({ type, size, children }: any) => (
    <span className={`cds--tag cds--tag--${type} cds--tag--${size}`} style={{ borderRadius: '1.5rem' }}>
        {children}
    </span>
);

function CSCSection({ heading, copy, footerLabel, onFooterClick, cards }: any) {
    return (
        <section className="csc-section">
            <div className="csc-section__intro">
                <h2 className="csc-section__heading">{heading}</h2>
                <p className="csc-section__copy">{copy}</p>
                <button className="csc-section__footer-link" onClick={onFooterClick}>
                    {footerLabel} <ArrowRight />
                </button>
            </div>
            <div className="csc-carousel">
                {cards.map((card: any, idx: number) => (
                    <div key={idx} className="csc-card" onClick={card.onClick}>
                        <p className="csc-card__eyebrow">{card.eyebrow}</p>
                        <div className="console-c4d-card__pictogram">
                            {card.pictogram}
                        </div>
                        <h3 className="csc-card__title">{card.title}</h3>
                        <p className="csc-card__copy">{card.copy}</p>
                        <div className="csc-card__cta">
                            Explorar <ArrowRight />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

const Tag = ({ type, size, children }: any) => (
    <span className={`cds--tag cds--tag--${type} cds--tag--${size}`} style={{ borderRadius: '1.5rem' }}>
        {children}
    </span>
);
