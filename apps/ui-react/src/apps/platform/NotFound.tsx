import React from 'react';
import { Button, Stack } from '@carbon/react';
import { Home } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();
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
                <h1 style={{ fontSize: '8rem', fontWeight: 600, margin: 0 }}>404</h1>
                <p className="cds--type-productive-heading-03">Coordenada não encontrada no genOS™.</p>
                <p className="cds--type-body-short-01" style={{ color: 'var(--cds-text-helper)' }}>
                    O recurso que você procura foi movido ou não existe neste tenant.
                </p>
                <Button
                    kind="primary"
                    renderIcon={Home}
                    onClick={() => navigate('/')}
                >
                    Voltar ao Início
                </Button>
            </Stack>
        </div>
    );
}
