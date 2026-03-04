import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SYSTEM_VERSIONS } from '../config/versions';
import {
  Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction, HeaderPanel, Switcher, SwitcherItem, SwitcherDivider,
  Theme, Button, Modal, TextInput, PasswordInput, AILabel, AILabelContent, AILabelActions, IconButton, Dropdown, ProgressBar
} from '@carbon/react';
import { Search as SearchIcon, Switcher as SwitcherIcon, Close as CloseIcon } from '@carbon/icons-react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';

export default function MasterLogin({
  authenticated,
  onLogin,
}: {
  authenticated: boolean;
  onLogin: (email: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    if (authenticated) {
      navigate('/');
    }
  }, [authenticated, navigate]);

  const handleLoginSubmit = async () => {
    if (!email || !password) return;

    setLoading(true);
    setLoadingStep(1);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Step 1 — Call edge function to provision/verify tenant (best-effort)
      await new Promise(r => setTimeout(r, 400));
      setLoadingStep(2);
      await supabase.functions.invoke('wix-auth-bridge', {
        body: { email: normalizedEmail, password },
        headers: { 'x-bridge-secret': import.meta.env.VITE_BRIDGE_SECRET || '' }
      }).catch(() => {
        // Non-fatal: tenant may already exist. Continue to Supabase auth.
        console.warn('wix-auth-bridge: tenant sync skipped (non-fatal)');
      });

      // Step 2 — Real Supabase auth with real JWT session
      setLoadingStep(3);
      await new Promise(r => setTimeout(r, 300));
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.session) throw new Error('Sessão não gerada. Verifique suas credenciais.');

      api.setActiveUserEmail(normalizedEmail);

      // Step 3 — Load profile via AuthContext
      setLoadingStep(4);
      const ok = await onLogin(normalizedEmail);

      if (ok) {
        await new Promise(r => setTimeout(r, 300));
        navigate('/');
      } else {
        throw new Error('Autenticação concluída, mas falha ao carregar perfil do operador.');
      }
    } catch (err: any) {
      console.error('Login falhou:', err);
      setError(err.message || 'Credenciais inválidas ou erro de rede.');
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    setLoading(true);
    setError('');

    // Redirect to the new ResetPassword route where they will input the new password
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setRecoverySuccess(true);
    }
  };


  const getLoadingHelperText = () => {
    switch (loadingStep) {
      case 1: return "Estabelecendo Handshake com Wix Identity...";
      case 2: return "Mapeando permissões de Tenant RLS...";
      case 3: return "Injetando chaves JWT seguras na sessão local...";
      case 4: return "Redirecionando para o ecosistema genOS...";
      default: return "Conectando...";
    }
  };

  return (
    <Theme theme="g100">
      <div style={{ position: 'relative', minHeight: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--cds-background)' }}>

        {/* Full Viewport Video Background */}
        <video
          src="/video.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            opacity: 1
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.0)', zIndex: 1 }} />

        {/* UI Shell */}
        <Header aria-label="Cestari Studio">
          <HeaderName prefix="Cestari Studio | genOS™">
          </HeaderName>
          <HeaderGlobalBar>
            <HeaderGlobalAction aria-label="Search" onClick={() => { }}>
              <SearchIcon size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              isActive={isMenuOpen}
            >
              <SwitcherIcon size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>

          <HeaderPanel aria-label="Menu Panel" expanded={isMenuOpen}>
            <Switcher aria-label="Platform Links">
              <SwitcherItem aria-label="Home" href="#">Home</SwitcherItem>
              <SwitcherItem aria-label="Documentation" href="#">Documentation</SwitcherItem>
              <SwitcherDivider />
              <SwitcherItem aria-label="genOS" href="#">genOS™ Core</SwitcherItem>
            </Switcher>
          </HeaderPanel>
        </Header>

        {/* Center Content Dropdown */}
        <div style={{ position: 'absolute', zIndex: 2, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ color: '#ffffff', fontSize: '3rem', fontWeight: 300, marginBottom: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            A Future-Proof Agency
          </h1>
          <div style={{ width: 400 }}>
            <Dropdown
              id="profile-dropdown"
              size="lg"
              aria-label="Perfil de Acesso"
              autoAlign
              decorator={
                <AILabel className="ai-label-container" size="xs">
                  <AILabelContent>
                    <div>
                      <p className="secondary">AI Explained</p>
                      <h2 className="ai-label-heading">84%</h2>
                      <p className="secondary bold">Confidence score</p>
                      <p className="secondary"><br></br>

                        The profile typology is predictively mapped to its RLS authority in the Headless system.</p><br></br>
                      <hr /><br></br>
                      <p className="secondary">Model</p>
                      <div className="login-version-card p-4">
                        <p className="bold">Helian {SYSTEM_VERSIONS.helianAI}</p>
                        <p className="cds--type-caption" style={{ color: '#8d8d8d' }}>AI Orchestrator Node</p>
                      </div>
                    </div>
                  </AILabelContent>
                </AILabel>
              }
              helperText=""
              items={[
                { id: 'console', label: 'Console (Client Hub)', disabled: false },
                { id: 'workstation', label: 'Workstation (Admin)', disabled: true }
              ]}
              itemToString={(item: any) => (item ? item.label : '')}
              label="Selecione seu portal de acesso"
              titleText=""
              onChange={({ selectedItem }) => {
                if (selectedItem && !selectedItem.disabled) {
                  setIsModalOpen(true);
                }
              }}
            />
          </div>
        </div>

        {/* The requested Login Modal with AI Label */}
        <Modal
          aria-label="Login to genOS"
          closeButtonLabel="Close"
          decorator={
            <AILabel className="ai-label-container" size="xs">
              <AILabelContent>
                <div>
                  <p className="secondary">AI Security Analyzed</p>
                  <h2 className="ai-label-heading">100%</h2>
                  <p className="secondary bold">Confidence score</p>
                  <p className="secondary">Este canal de comunicação viaja através de arquitetura Headless.</p>
                  <hr />
                  <p className="secondary">Authentication Model</p>
                  <p className="bold">Enterprise OAuth2</p>
                </div>
              </AILabelContent>
            </AILabel>
          }
          modalHeading="genOS™ Authentication"
          modalLabel={isForgotPassword ? "Recuperação de Senha" : "Login"}
          open={isModalOpen}
          onRequestClose={() => {
            if (!loading) {
              setIsModalOpen(false);
              setIsForgotPassword(false);
              setRecoverySuccess(false);
              setError('');
            }
          }}
          onRequestSubmit={isForgotPassword ? handleForgotPasswordSubmit : handleLoginSubmit}
          primaryButtonText={loading ? "Carregando..." : isForgotPassword ? (recoverySuccess ? "Voltar ao Login" : "Recuperar Senha") : "Sign in"}
          primaryButtonDisabled={loading || (!isForgotPassword && (!email || !password)) || (isForgotPassword && (!email && !recoverySuccess))}
          secondaryButtonText={isForgotPassword && !recoverySuccess ? "Voltar" : "Cancel"}
          onSecondarySubmit={() => {
            if (isForgotPassword) {
              setIsForgotPassword(false);
              setError('');
              setRecoverySuccess(false);
            } else {
              setIsModalOpen(false);
            }
          }}
          size="sm"
        >
          {loading && !isForgotPassword ? (
            <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', minHeight: '200px', justifyContent: 'center' }}>
              <ProgressBar
                label="Autenticando Identidade do Operador"
                helperText={getLoadingHelperText()}
                status={loadingStep === 4 ? "finished" : "active"}
                value={loadingStep * 25}
              />
            </div>
          ) : (
            <>
              {isForgotPassword ? (
                <>
                  <p style={{ marginBottom: '2rem' }}>
                    {recoverySuccess
                      ? "Se o e-mail existir na nossa base, você receberá um link seguro de recuperação em instantes."
                      : "Esqueceu sua senha? Informe seu e-mail para receber um link de redefinição seguro."}
                  </p>

                  {error && <div style={{ color: 'var(--cds-support-error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

                  {recoverySuccess && (
                    <div style={{ color: 'var(--cds-support-success)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      Instruções enviadas com sucesso.
                    </div>
                  )}

                  {!recoverySuccess && (
                    <div style={{ marginBottom: '24px' }}>
                      <TextInput
                        data-modal-primary-focus
                        id="email-reset-input"
                        labelText="E-mail"
                        placeholder="youremail@yourbusiness.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ marginBottom: '2rem' }}>
                    Connect with your credentials
                  </p>

                  {error && <div style={{ color: 'var(--cds-support-error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

                  <div style={{ marginBottom: '24px' }}>
                    <TextInput
                      data-modal-primary-focus
                      id="email-input"
                      labelText="E-mail"
                      placeholder="youremail@yourbusiness.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <PasswordInput
                      id="password-input"
                      labelText="Password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: '24px', textAlign: 'right' }}>
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                      }}
                    >
                      Esqueci minha senha
                    </Button>
                  </div>

                  {/* Dev-only verification bypass */}
                  {import.meta.env.DEV && (
                    <div style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.15 }}>
                      <Button
                        kind="ghost"
                        size="sm"
                        onClick={() => {
                          api.setActiveUserEmail('mail@cestari.studio');
                          onLogin('mail@cestari.studio');
                        }}
                      >
                        Dev Bypass
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Modal>

      </div>
    </Theme>
  );
}
