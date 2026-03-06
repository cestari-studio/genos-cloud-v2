import React, { useEffect } from 'react';
import MarketingLayout from '@/layouts/MarketingLayout';

// Import C4D components
import '@carbon/ibmdotcom-web-components/es/components/pricing-table/index.js';
import '@carbon/ibmdotcom-web-components/es/components/leadspace/index.js';
import '@carbon/ibmdotcom-web-components/es/components/link-with-icon/index.js';

import { t } from '@/config/locale';

const PricingPage: React.FC = () => {
    useEffect(() => {
        document.title = `${t('m_pricingTitle')} | Cestari Studio Authority`;
    }, []);

    return (
        <MarketingLayout>
            <section className="pricing-hero">
                <c4d-leadspace size="medium" theme="g100">
                    <c4d-leadspace-heading>{t('m_pricingTitle')}</c4d-leadspace-heading>
                    <c4d-leadspace-copy>
                        {t('m_pricingSubtitle')}
                    </c4d-leadspace-copy>
                </c4d-leadspace>
            </section>

            <section className="pricing-grid" style={{ padding: '6rem 2rem', backgroundColor: 'var(--cds-background)' }}>
                <div className="cds--grid">
                    <div className="cds--row">
                        <div className="cds--col-lg-16">
                            <c4d-pricing-table highlight-column={2} highlight-label="Most Popular">
                                <c4d-pricing-table-header>
                                    <c4d-pricing-table-header-cell>
                                        Starter
                                        <span slot="price">R$ 490/mês</span>
                                        <span slot="description">Para profissionais individuais.</span>
                                    </c4d-pricing-table-header-cell>
                                    <c4d-pricing-table-header-cell>
                                        Growth
                                        <span slot="price">R$ 990/mês</span>
                                        <span slot="description">Escala para agências.</span>
                                    </c4d-pricing-table-header-cell>
                                    <c4d-pricing-table-header-cell>
                                        Scale
                                        <span slot="price">R$ 2.490/mês</span>
                                        <span slot="description">Potência industrial ilimitada.</span>
                                    </c4d-pricing-table-header-cell>
                                </c4d-pricing-table-header>

                                <c4d-pricing-table-head>
                                    <c4d-pricing-table-header-row>
                                        <c4d-pricing-table-header-cell>Recursos de IA</c4d-pricing-table-header-cell>
                                    </c4d-pricing-table-header-row>
                                </c4d-pricing-table-head>

                                <c4d-pricing-table-body>
                                    <c4d-pricing-table-row>
                                        <c4d-pricing-table-cell tagName="th">Posts Premium / mês</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>12</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>24</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>50</c4d-pricing-table-cell>
                                    </c4d-pricing-table-row>

                                    <c4d-pricing-table-row>
                                        <c4d-pricing-table-cell tagName="th">Tokens de IA</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>5.000</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>15.000</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>50.000</c4d-pricing-table-cell>
                                    </c4d-pricing-table-row>

                                    <c4d-pricing-table-row>
                                        <c4d-pricing-table-cell tagName="th">Quantum Scoring (QHE)</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>-</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>Habilitado</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>Habilitado</c4d-pricing-table-cell>
                                    </c4d-pricing-table-row>

                                    <c4d-pricing-table-row>
                                        <c4d-pricing-table-cell tagName="th">Multi-rede / Agendamento</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>Básico</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>Avançado</c4d-pricing-table-cell>
                                        <c4d-pricing-table-cell>Enterprise</c4d-pricing-table-cell>
                                    </c4d-pricing-table-row>
                                </c4d-pricing-table-body>

                                <c4d-pricing-table-footer>
                                    <c4d-pricing-table-header-cell>
                                        <c4d-link-with-icon href="/login" cta-type="local">Começar agora</c4d-link-with-icon>
                                    </c4d-pricing-table-header-cell>
                                    <c4d-pricing-table-header-cell>
                                        <c4d-link-with-icon href="/login" cta-type="local">Upgrade Growth</c4d-link-with-icon>
                                    </c4d-pricing-table-header-cell>
                                    <c4d-pricing-table-header-cell>
                                        <c4d-link-with-icon href="mailto:vendas@cestari.studio" cta-type="local">Falar com Consultor</c4d-link-with-icon>
                                    </c4d-pricing-table-header-cell>
                                </c4d-pricing-table-footer>
                            </c4d-pricing-table>
                        </div>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};

export default PricingPage;




