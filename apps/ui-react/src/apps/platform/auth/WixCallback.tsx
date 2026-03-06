import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Theme, InlineLoading, ProgressBar, ActionableNotification } from '@carbon/react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/shared/contexts/AuthContext';

const WixCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [message, setMessage] = useState('Establishing Wix Handshake...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const email = searchParams.get('email'); // Fallback if no JWT logic is ready on Wix side

            if (!token && !email) {
                setStatus('error');
                setError('Invalid authentication request: Missing token or email.');
                return;
            }

            try {
                setMessage('Validating Wix Identity JWT...');

                // Call the bridge edge function
                const { data, error: bridgeError } = await supabase.functions.invoke('wix-auth-bridge', {
                    body: { token, email, source: 'wix-callback' },
                    headers: { 'x-bridge-secret': import.meta.env.VITE_BRIDGE_SECRET || '' }
                });

                if (bridgeError) throw bridgeError;

                setMessage('Mapeando permissões de Tenant RLS...');

                // The bridge function returns a session if it performed a sign-in
                if (data.session) {
                    const { error: sessionError } = await supabase.auth.setSession(data.session);
                    if (sessionError) throw sessionError;
                }

                if (data.user?.email) {
                    setMessage('Injetando chaves JWT seguras...');
                    const ok = await login(data.user.email);
                    if (ok) {
                        setStatus('success');
                        setMessage('Redirecionando para o ecosistema genOS...');
                        setTimeout(() => {
                            navigate(data.onboarding_completed === false ? '/onboarding' : '/');
                        }, 1000);
                    } else {
                        throw new Error('Falha ao inicializar perfil do operador.');
                    }
                }

            } catch (err: any) {
                console.error('Wix Auth Bridge Error:', err);
                setStatus('error');
                setError(err.message || 'An unexpected error occurred during the handshake.');
            }
        };

        handleCallback();
    }, [searchParams, navigate, login]);

    return (
        <Theme theme="g100">
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: '#000000',
                padding: '2rem'
            }}>
                <div style={{ width: '100%', maxWidth: '400px' }}>
                    {status === 'loading' && (
                        <>
                            <ProgressBar
                                label="genOS™ Gateway"
                                helperText={message}
                                status="active"
                                value={status === 'loading' ? 50 : 100}
                            />
                            <InlineLoading
                                description="Verifying Security Claims..."
                                style={{ marginTop: '1rem', justifyContent: 'center' }}
                            />
                        </>
                    )}

                    {status === 'error' && (
                        <ActionableNotification
                            kind="error"
                            title="Authentication Failed"
                            subtitle={error}
                            inline
                            onCloseButtonClick={() => navigate('/login')}
                            actionButtonLabel="Back to Login"
                        />
                    )}

                    {status === 'success' && (
                        <ProgressBar
                            label="genOS™ Gateway"
                            helperText={message}
                            status="finished"
                            value={100}
                        />
                    )}
                </div>

                <p style={{ marginTop: '2rem', color: 'var(--cds-text-helper)', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono' }}>
                    Wix Auth Bridge™ v5.0.0 | Connection Secure
                </p>
            </div>
        </Theme>
    );
};

export default WixCallback;
