// genOS Lumina — Content Factory Terms & Conditions Modal
// Persistent blocking modal until accepted, version tracked via user_metadata

import React, { useState, useEffect } from 'react';
import {
    Modal,
    Stack,
    Checkbox,
    InlineNotification,
    AILabel,
    AILabelContent
} from '@carbon/react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/shared/contexts/AuthContext';
import { SYSTEM_VERSIONS } from '@/config/versions';

// IMPORTANT: Bump this version to trigger the modal again for all users
export const CURRENT_TC_VERSION = SYSTEM_VERSIONS.contentFactory;

export default function TermsAcknowledgmentModal() {
    const { me, refreshMe } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAcceptance = async () => {
            if (!me?.user) return;

            const { data, error } = await supabase.auth.getUser();
            if (error || !data.user) {
                console.warn('Could not fetch user to check T&C version', error);
                return;
            }

            const userMeta = data.user.user_metadata || {};
            if (userMeta.cf_tc_version !== CURRENT_TC_VERSION) {
                setIsOpen(true);
            }
        };

        checkAcceptance();
    }, [me?.user]);

    const handleAccept = async () => {
        if (!accepted) {
            setError('Você precisa marcar a caixa de seleção para aceitar os termos.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { cf_tc_version: CURRENT_TC_VERSION }
            });

            if (updateError) throw updateError;

            // Success - close modal and refresh context if needed
            setIsOpen(false);
            if (refreshMe) refreshMe();

        } catch (err: any) {
            console.error('Error updating T&C version:', err);
            setError(err.message || 'Ocorreu um erro ao registrar o aceite. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            preventCloseOnClickOutside
            danger={false}
            modalHeading="Termos de Uso do Content Factory"
            modalLabel={`Versão ${CURRENT_TC_VERSION}`}
            primaryButtonText={saving ? 'Salvando...' : 'Li e Aceito'}
            secondaryButtonText="Não Aceito (Sair)"
            onRequestSubmit={handleAccept}
            onRequestClose={() => {
                // If they decline, log them out or redirect
                supabase.auth.signOut().then(() => {
                    window.location.href = '/login';
                });
            }}
            primaryButtonDisabled={!accepted || saving}
            decorator={
                <AILabel autoAlign kind="inline" size="sm">
                    <AILabelContent>
                        <div className="ai-badge-popover">
                            <div className="ai-badge-popover__header">
                                <span className="ai-badge-popover__eyebrow">COMPLIANCE</span>
                                <h4 className="ai-badge-popover__title">Governança de Dados IA</h4>
                            </div>
                            <p className="ai-badge-popover__desc">
                                Para utilizar o motor de geração de IA corporativo, exigimos a leitura e aceite das diretrizes de responsabilidade de conteúdo, privacidade de dados de fine-tuning e limites operacionais.
                            </p>
                        </div>
                    </AILabelContent>
                </AILabel>
            }
        >
            <Stack gap={5}>
                {error && (
                    <InlineNotification
                        kind="error"
                        title="Erro"
                        subtitle={error}
                        lowContrast
                        onCloseButtonClick={() => setError(null)}
                    />
                )}

                <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '1rem', border: '1px solid var(--cds-border-subtle)', padding: '1rem', backgroundColor: 'var(--cds-layer-01)' }}>
                    <Stack gap={4}>
                        <h4 className="cds--type-productive-heading-02">Política de Uso Aceitável</h4>
                        <p className="cds--type-body-short-01">
                            Ao utilizar o Content Factory e os serviços de inteligência artificial generativa associados ("Serviços"), você concorda em cumprir estes termos e compromete-se a:
                        </p>
                        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem' }} className="cds--type-body-short-01">
                            <li style={{ marginBottom: '0.5rem' }}>Não utilizar o sistema para gerar ou promover conteúdo ilegal, difamatório, de ódio ou prejudicial.</li>
                            <li style={{ marginBottom: '0.5rem' }}>Garantir que os inputs (textos e mídias) enviados aos modelos estão livres de informações sensíveis ou dados pessoais sujeitos a sigilo (ex: PII, dados médicos).</li>
                            <li style={{ marginBottom: '0.5rem' }}>Compreender que o genOS atua como facilitador tecnológico; a auditoria final e a responsabilidade civil pelo conteúdo publicado (mesmo que aprovado pelo nosso Quality Gate) recaem integralmente sobre sua empresa.</li>
                        </ul>

                        <h4 className="cds--type-productive-heading-02" style={{ marginTop: '0.5rem' }}>Consumo e Disponibilidade</h4>
                        <p className="cds--type-body-short-01">
                            A disponibilidade dos modelos (ex: Gemini, IBM Granite) depende de fatores de rede externos. O faturamento de Tokens segue as métricas ativas do seu pacote contratado. Tentativas de vazamento de prompts ou abuso dos algoritmos resultarão em suspensão imediata da conta via isolamento do Tenant.
                        </p>
                    </Stack>
                </div>

                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--cds-layer-accent-01)' }}>
                    <Checkbox
                        id="tc-accept-checkbox"
                        labelText="Li e concordo com os Termos de Uso do Content Factory."
                        checked={accepted}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>, { checked }: { checked: boolean }) => setAccepted(checked)}
                    />
                </div>
            </Stack>
        </Modal>
    );
}
