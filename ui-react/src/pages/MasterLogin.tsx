import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction, HeaderPanel, Switcher, SwitcherItem, SwitcherDivider,
  Theme, Button, Modal, TextInput, PasswordInput, AILabel, AILabelContent, AILabelActions, IconButton, Dropdown, ProgressBar
} from '@carbon/react';
import { Search as SearchIcon, Menu as MenuIcon, Close as CloseIcon } from '@carbon/icons-react';
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
      // 1. Visual progression
      await new Promise(r => setTimeout(r, 600));
      setLoadingStep(2);

      // 2. Real call to Supabase Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('wix-auth-bridge', {
        body: { email: email.trim().toLowerCase(), password }
      });

      if (functionError || !data) {
        throw new Error(functionError?.message || 'Erro ao comunicar com a ponte de autenticação.');
      }

      if (data.error) {
        throw new Error(data.error);
      }
      if (!data.session && !data.user) {
        throw new Error('Credenciais inválidas ou Tenant não encontrado.');
      }

      setLoadingStep(3);
      await new Promise(r => setTimeout(r, 600));

      // 2.1 PERSIST SUPABASE SESSION — role & permissions come from backend /api/me
      if (data.session && data.session.access_token && data.session.access_token.includes('.')) {
        await supabase.auth.setSession(data.session);
      }

      if (data.user?.email) {
        api.setActiveUserEmail(data.user.email);
      }

      // 3. Sincroniza com o AuthContext no frontend
      const ok = await onLogin(email.trim().toLowerCase());

      if (ok) {
        setLoadingStep(4);
        await new Promise(r => setTimeout(r, 400));
        navigate('/');
      } else {
        throw new Error('Autenticação concluída, mas falha ao carregar perfil do operador.');
      }
    } catch (err: any) {
      console.error("Login falhou:", err);
      setError(err.message || "Credenciais Inválidas ou Erro de Rede");
      setLoading(false);
      setLoadingStep(0);
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
              {isMenuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
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
                      <p className="bold">Helian v1.0</p>
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
          modalLabel="Login"
          open={isModalOpen}
          onRequestClose={() => { if (!loading) setIsModalOpen(false); }}
          onRequestSubmit={handleLoginSubmit}
          primaryButtonText={loading ? "Authenticating" : "Sign in"}
          primaryButtonDisabled={loading || !email || !password}
          secondaryButtonText="Cancel"
          size="sm"
        >
          {loading ? (
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

              <div style={{ marginBottom: '24px' }}>
                <PasswordInput
                  id="password-input"
                  labelText="Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
        </Modal>

      </div>
    </Theme>
  );
}
