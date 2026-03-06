import React from 'react';
import { Button, Stack } from '@carbon/react';
import { Home } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import './NotFound.scss';


export default function NotFound() {
    const navigate = useNavigate();
    return (
        <div className="not-found-container">
            <Stack gap={6} style={{ textAlign: 'center', alignItems: 'center' }}>
                <h1 className="not-found-title">404</h1>
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
