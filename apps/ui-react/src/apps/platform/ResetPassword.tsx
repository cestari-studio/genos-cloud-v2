import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Theme, Modal, PasswordInput } from '@carbon/react';
import { supabase } from '@/services/supabase';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleResetSubmit = async () => {
        if (!password || password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        setLoading(true);
        setError('');

        // Supabase automatically parses the hash fragment #access_token=... from URL
        // and sets the implicit session. updateUser() updates the password for that session.
        const { error: updateError } = await supabase.auth.updateUser({ password });

        setLoading(false);
        if (updateError) {
            setError(updateError.message);
        } else {
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3500);
        }
    };

    return (
        <Theme theme="g100">
            <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: 'var(--cds-background)' }}>
                <Modal
                    aria-label="Redefinição de Senha"
                    open={true}
                    modalHeading="Redefinir Senha"
                    primaryButtonText={loading ? "Salvando..." : success ? "Sucesso!" : "Redefinir Senha"}
                    primaryButtonDisabled={loading || password.length < 6 || success}
                    secondaryButtonText="Voltar ao Login"
                    onRequestClose={() => navigate('/login')}
                    onRequestSubmit={handleResetSubmit}
                    onSecondarySubmit={() => navigate('/login')}
                    size="sm"
                >
                    {success ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                            <p style={{ color: 'var(--cds-support-success)', marginBottom: '1rem' }}>
                                Senha atualizada com sucesso! Você será redirecionado para o login.
                            </p>
                        </div>
                    ) : (
                        <>
                            <p style={{ marginBottom: '2rem', fontSize: '1rem' }}>
                                Digite sua nova senha de acesso ao genOS™.
                            </p>
                            {error && <div style={{ color: 'var(--cds-support-error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                            <div style={{ marginBottom: '24px' }}>
                                <PasswordInput
                                    id="new-password"
                                    labelText="Nova Senha"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </Modal>
            </div>
        </Theme>
    );
}
