'use client';

import React from 'react';
import {
    Tile, Stack, Button, InlineNotification
} from '@carbon/react';
import { Launch, ArrowLeft, Help } from '@carbon/icons-react';
import { Link } from 'react-router-dom';

export default function WixPasswordRecovery() {
    // URL do seu site Wix onde o fluxo de recuperação acontece
    const WIX_RESET_URL = "https://www.cestaristudio.com/_api/wix-sm/reset-password";

    return (
        <div className="recovery-container theme-gray-100" style={{
            backgroundColor: '#161616',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Tile style={{ width: '450px', padding: '2.5rem', backgroundColor: '#262626', border: '1px solid #393939' }}>
                <Stack gap={6}>
                    {/* Cabeçalho de Suporte */}
                    <div style={{ textAlign: 'center' }}>
                        <Help size={32} fill="#f1c21b" />
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginTop: '1rem' }}>
                            Problemas com o acesso?
                        </h3>
                        <p className="cds--type-body-short-01" style={{ color: '#8d8d8d', marginTop: '0.5rem' }}>
                            Como o genOS utiliza sua conta da Cestari Studio, a recuperação de senha é processada pelo nosso servidor de identidade principal.
                        </p>
                    </div>

                    <InlineNotification
                        kind="info"
                        title="Sincronização Ativa"
                        subtitle="Ao alterar sua senha no site oficial, ela será atualizada automaticamente aqui no Terminal genOS."
                        hideCloseButton
                    />

                    <Stack gap={4}>
                        <Button
                            kind="primary"
                            renderIcon={Launch}
                            style={{ width: '100%' }}
                            onClick={() => window.open(WIX_RESET_URL, '_blank')}
                        >
                            Redefinir no Site Oficial
                        </Button>

                        <Link to="/auth/login" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            textDecoration: 'none',
                            color: '#78a9ff'
                        }}>
                            <ArrowLeft size={16} />
                            Voltar para o Login CLI
                        </Link>
                    </Stack>

                    <hr style={{ border: 'none', borderTop: '1px solid #393939' }} />

                    <p className="cds--type-caption-01" style={{ color: '#6f6f6f', textAlign: 'center' }}>
                        Se você não tiver acesso ao e-mail cadastrado, entre em contato com o suporte da Cestari Studio pelo e-mail ocestari89@gmail.com.
                    </p>
                </Stack>
            </Tile>
        </div>
    );
}
