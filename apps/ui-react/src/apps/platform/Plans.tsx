import React, { useState } from 'react';
import {
    Grid,
    Column,
    Tile,
    Button,
    Stack,
    Tag,
    Layer,
    Section,
} from '@carbon/react';
import { Checkmark, Star, Rocket, Enterprise } from '@carbon/icons-react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { api } from '@/services/api';
import { t } from '@/config/locale';
import PageLayout from '@/components/PageLayout';
import './Plans.scss';


interface Plan {
    id: string;
    name: string;
    price: string;
    description: string;
    features: string[];
    priceId: string;
    tier: string;
    icon: any;
    tag?: string;
}

const PLANS: Plan[] = [
    {
        id: 'starter',
        name: 'Starter',
        price: 'R$ 490',
        description: 'Ideal para profissionais liberais e pequenos negócios.',
        priceId: 'price_1T7T4lAVumMMnAd0tOjBVRdH',
        tier: 'starter',
        icon: Rocket,
        features: [
            '12 Posts Premium / mês',
            '5.000 Tokens de IA',
            'Agendamento Multi-rede',
            'Suporte via Email',
        ]
    },
    {
        id: 'growth',
        name: 'Growth',
        price: 'R$ 990',
        description: 'Para marcas em crescimento exponencial.',
        priceId: 'price_1T7T4sAVumMMnAd0FKCD33pl',
        tier: 'growth',
        icon: Star,
        tag: 'Mais Popular',
        features: [
            '24 Posts Premium / mês',
            '15.000 Tokens de IA',
            'Quantum Scoring (QHE)',
            'Análise de Sentimento Real-time',
            'Suporte Prioritário',
        ]
    },
    {
        id: 'scale',
        name: 'Scale',
        price: 'R$ 2.490',
        description: 'Potência máxima para agências e grandes marcas.',
        priceId: 'price_1T7T53AVumMMnAd0RIJCs8Yg',
        tier: 'scale',
        icon: Enterprise,
        features: [
            '50 Posts Premium / mês',
            '50.000 Tokens de IA',
            'Isolamento Hierárquico Master',
            'API de Integração Direta',
            'Gerente de Conta Dedicado',
        ]
    }
];

export default function Plans() {
    const { me } = useAuth();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const handleUpgrade = async (plan: Plan) => {
        setLoadingPlan(plan.id);
        try {
            const result = await api.edgeFn<any>('stripe-checkout', {
                action: 'create_schedule_subscription',
                tenant_id: me.tenant?.id,
                price_id: plan.priceId,
                tier: plan.tier
            });

            if (result.success && result.data?.url) {
                window.location.href = result.data.url;
            } else {
                throw new Error(result.error || 'Failed to create checkout session');
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            alert(`Erro ao iniciar checkout: ${err.message}`);
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <PageLayout
            pageName="Nossos Planos"
            pageDescription="Escolha o plano ideal para a escala da sua operação."
        >
            <Stack gap={7}>
                <div className="plans-header">
                    <h1 className="cds--type-display-01 plans-title">Escolha seu plano genOS™</h1>
                    <p className="cds--type-body-long-02 plans-subtitle">
                        Desbloqueie o poder da IA Quântica para sua estratégia de conteúdo.
                    </p>
                </div>

                <Grid>
                    {PLANS.map((plan) => (
                        <Column lg={4} md={4} sm={4} key={plan.id}>
                            <Layer>
                                <Tile className={`plan-card ${plan.tag ? 'plan-card--featured' : ''}`}>
                                    {plan.tag && (
                                        <Tag
                                            type="blue"
                                            size="sm"
                                            className="plan-tag"
                                        >
                                            {plan.tag}
                                        </Tag>
                                    )}

                                    <Stack gap={5} className="plan-content-stack">
                                        <div className="plan-header-row">
                                            <plan.icon size={32} />
                                            <div className="plan-title-container">
                                                <h2 className="cds--type-productive-heading-04">{plan.name}</h2>
                                                <p className="cds--type-productive-heading-03 plan-price">
                                                    {plan.price}<span className="plan-price-period">/mês</span>
                                                </p>
                                            </div>
                                        </div>

                                        <p className="cds--type-body-short-01">{plan.description}</p>

                                        <Section className="plan-features-section">
                                            <Stack gap={3}>
                                                {plan.features.map((feature, idx) => (
                                                    <div key={idx} className="plan-feature-item">
                                                        <Checkmark size={16} className="plan-feature-icon" />
                                                        <span className="cds--type-body-short-01">{feature}</span>
                                                    </div>
                                                ))}
                                            </Stack>
                                        </Section>
                                    </Stack>

                                    <div className="plan-action-container">
                                        <Button
                                            kind={plan.tag ? 'primary' : 'tertiary'}
                                            className="plan-button"
                                            onClick={() => handleUpgrade(plan)}
                                        >
                                            {me.config?.schedule_tier === plan.tier ? 'Plano Atual' : 'Assinar Agora'}
                                        </Button>
                                    </div>
                                </Tile>
                            </Layer>
                        </Column>
                    ))}
                </Grid>

                <div className="plans-footer">
                    <p className="cds--type-helper-text-01">
                        Todos os planos incluem acesso ao gerador básico e suporte técnico.
                        Precisa de algo sob medida? <a href="mailto:contato@cestari.studio" className="plans-footer-link">Fale conosco</a>.
                    </p>
                </div>
            </Stack>
        </PageLayout>
    );
}
