import React, { useEffect } from 'react';
import MarketingLayout from '../../layouts/MarketingLayout';

// Import C4D components
import '@carbon/ibmdotcom-web-components/es/components/leadspace/index.js';
import '@carbon/ibmdotcom-web-components/es/components/content-section/index.js';
import '@carbon/ibmdotcom-web-components/es/components/card-section-carousel/index.js';
import '@carbon/ibmdotcom-web-components/es/components/card/index.js';
import '@carbon/ibmdotcom-web-components/es/components/link-with-icon/index.js';
import '@carbon/ibmdotcom-web-components/es/components/feature-section/index.js';

import { t } from '../../config/locale';
import { useTranslation } from 'react-i18next';

const HomePage: React.FC = () => {
    const { t: i18nT } = useTranslation();

    useEffect(() => {
        document.title = `${t('m_homeTitle')} | genOS™ v5.0.0 Authority Hub`;
    }, []);

    return (
        <MarketingLayout>
            <section className="homepage-hero">
                {/* @ts-ignore */}
                <c4d-leadspace size="super" gradient theme="g100">
                    <c4d-leadspace-heading>{t('m_homeTitle')}</c4d-leadspace-heading>
                    <c4d-leadspace-copy>
                        {t('m_homeSubtitle')}
                    </c4d-leadspace-copy>
                    <c4d-leadspace-cta>
                        <c4d-link-with-icon href="/login" cta-type="local">
                            {t('m_homeCta')}
                        </c4d-link-with-icon>
                    </c4d-leadspace-cta>
                </c4d-leadspace>
            </section>

            <section className="industrial-authority" style={{ padding: '4rem 0', backgroundColor: '#161616' }}>
                <div className="cds--grid">
                    <div className="cds--row">
                        <div className="cds--col-lg-16">
                            <c4d-feature-section>
                                <c4d-image slot="image" default-src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1600" alt="Industrial AI Operations"></c4d-image>
                                <c4d-feature-section-heading>Zero-Waste Intelligence</c4d-feature-section-heading>
                                <c4d-feature-section-copy>
                                    O genOS™ v5.0.0 foi reconstruído sob o paradigma da orquestração industrial.
                                    Sem desperdício de tokens, sem latência desnecessária. Apenas performance bruta e segurança estrita.
                                </c4d-feature-section-copy>
                                <c4d-link-with-icon slot="footer" href="/solutions" cta-type="local">
                                    Conheça a arquitetura Helian™
                                </c4d-link-with-icon>
                            </c4d-feature-section>
                        </div>
                    </div>
                </div>
            </section>

            <section className="roadmap-preview" style={{ padding: '6rem 0', backgroundColor: '#000000' }}>
                <div className="cds--grid">
                    <div className="cds--row">
                        <div className="cds--col-lg-12">
                            <c4d-content-section-heading>{t('m_roadmapTitle')}</c4d-content-section-heading>
                            <c4d-content-section-copy>
                                {t('m_roadmapSubtitle')}
                            </c4d-content-section-copy>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '3rem' }}>
                    <c4d-card-section-carousel>
                        <c4d-card href="https://github.com/cestari-studio/genos-cloud-v2" cta-type="local">
                            <c4d-card-heading>v5.0.0 Hardening</c4d-card-heading>
                            <c4d-card-copy>Migração completa para Zero-Leak RLS e orquestração determinística no Vercel Edge.</c4d-card-copy>
                            <c4d-card-footer>
                                Concluído
                            </c4d-card-footer>
                        </c4d-card>

                        <c4d-card href="#" cta-type="local">
                            <c4d-card-heading>v5.1.0 Multi-modal</c4d-card-heading>
                            <c4d-card-copy>Integração de agentes autônomos para análise de vídeo e síntese de voz industrial.</c4d-card-copy>
                            <c4d-card-footer>
                                Planejado
                            </c4d-card-footer>
                        </c4d-card>

                        <c4d-card href="#" cta-type="local">
                            <c4d-card-heading>Quantum Pulse AI</c4d-card-heading>
                            <c4d-card-copy>Motor de recomendação preditiva baseado em séries temporais de performance de conteúdo.</c4d-card-copy>
                            <c4d-card-footer>
                                Pesquisa
                            </c4d-card-footer>
                        </c4d-card>
                    </c4d-card-section-carousel>
                </div>
            </section>

            <style>{`
                .homepage-hero c4d-leadspace {
                    --cds-ui-background: #161616;
                }
                .roadmap-preview {
                    border-top: 1px solid #393939;
                }
            `}</style>
        </MarketingLayout>
    );
};

export default HomePage;
