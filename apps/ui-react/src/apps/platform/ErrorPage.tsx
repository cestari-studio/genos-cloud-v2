import React from 'react';
import { Button, Stack } from '@carbon/react';
import { MisuseOutline } from '@carbon/icons-react';

export default function ErrorPage() {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: '#ffffff'
        }}>
            <Stack gap={6} style={{ textAlign: 'center', alignItems: 'center' }}>
                <MisuseOutline size={64} color="var(--cds-support-error)" />
                <h1 className="cds--type-productive-heading-05">System Kernel Panic</h1>
                <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-helper)' }}>
                    Ocorreu um erro crítico no processamento da página. <br />
                    Relatório de erro enviado automaticamente ao Cestari Studio.
                </p>
                <Button
                    kind="secondary"
                    onClick={() => window.location.reload()}
                >
                    Reiniciar Sessão
                </Button>
            </Stack>
        </div>
    );
}
