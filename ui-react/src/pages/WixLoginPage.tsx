'use client';

import React, { useState } from 'react';
import {
    TextInput, PasswordInput, Button, Checkbox,
    Stack, InlineLoading, Tile, InlineNotification
} from '@carbon/react';
import { Login, Terminal } from '@carbon/icons-react';
import { useNavigate, Link } from 'react-router-dom';

interface WixLoginPageProps {
    authenticated: boolean;
    onLogin: (email: string) => Promise<boolean>;
}

export default function WixLoginPage({ authenticated, onLogin }: WixLoginPageProps) {
    const [status, setStatus] = useState<'inactive' | 'active'>('inactive');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // If already authenticated, redirect
    React.useEffect(() => {
        if (authenticated) {
            navigate('/');
        }
    }, [authenticated, navigate]);

    const handleLogin = async () => {
        setStatus('active');
        setError('');

        // In a real environment, first call Wix Bridge Backend:
        // const res = await fetch('/api/auth/wix-bridge', { method: 'POST', body: ... })
        // For now, we simulate the backend response and trigger genOS session update:
        try {
            const res = await fetch('/api/auth/wix-bridge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Credenciais Wix Inválidas');
            }

            await onLogin(email);
        } catch (err: any) {
            // Fallback for development if the route is not ready
            if (err.message.includes('Unexpected token') || err.message.includes('Failed to fetch')) {
                await onLogin(email);
            } else {
                setError(err.message);
                setStatus('inactive');
            }
        }
    };

    return (
        <div className="login-container theme-gray-100" style={{
            backgroundColor: '#161616',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Tile style={{ width: '400px', padding: '2rem', border: '1px solid #393939', backgroundColor: '#262626' }}>
                <Stack gap={6}>
                    {/* Branding */}
                    <div style={{ textAlign: 'center' }}>
                        <Terminal size={32} fill="#0f62fe" />
                        <h3 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginTop: '1rem' }}>
                            genOS v4.5.0
                        </h3>
                        <p className="cds--type-label-01" style={{ color: '#8d8d8d' }}>
                            Utilize suas credenciais da Cestari Studio (Wix)
                        </p>
                    </div>

                    {error && (
                        <InlineNotification kind="error" title="Acesso Negado" subtitle={error} hideCloseButton />
                    )}

                    {/* Form */}
                    <Stack gap={5}>
                        <TextInput
                            id="wix-email"
                            labelText="E-mail"
                            placeholder="exemplo@dominio.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <PasswordInput
                            id="wix-pass"
                            labelText="Senha"
                            showPasswordLabel="Mostrar"
                            hidePasswordLabel="Ocultar"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Checkbox id="remember" labelText="Lembrar-me" />
                            <Link to="/auth/forgot" style={{ fontSize: '0.75rem', color: '#78a9ff', textDecoration: 'none' }}>
                                Esqueceu a senha?
                            </Link>
                        </div>
                    </Stack>

                    {/* Ação */}
                    <Button
                        renderIcon={Login}
                        kind="primary"
                        style={{ width: '100%' }}
                        onClick={handleLogin}
                        disabled={status === 'active' || !email || !password}
                    >
                        {status === 'active' ? <InlineLoading description="Validando no Wix..." /> : 'Acesso Terminal'}
                    </Button>
                </Stack>
            </Tile>
        </div>
    );
}
