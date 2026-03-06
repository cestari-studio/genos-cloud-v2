import React from 'react';
import {
    Grid,
    Column,
    Stack,
    Section,
} from '@carbon/react';
import PageLayout from '../components/PageLayout';

export default function SocialHub() {
    return (
        <PageLayout
            pageName="Social Hub™"
            pageDescription="Logística e automação de interações multicanais."
            aiExplanation="O Social Hub integra pg_cron para agendamento determinístico e Helian™ AI para resposta autônoma a comentários."
        >
            <Section style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--cds-border-subtle)' }}>
                <Stack gap={4} style={{ textAlign: 'center' }}>
                    <h3 className="cds--type-productive-heading-04">Social Hub Workstation</h3>
                    <p className="cds--type-body-short-01">Módulo em fase de ativação (v5.1). <br />O agendamento via Matrix List já está operacional.</p>
                </Stack>
            </Section>
        </PageLayout>
    );
}
