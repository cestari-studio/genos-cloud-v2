import { useState, type ReactNode } from 'react';
import { Modal, Link, AILabel, AILabelContent, IconButton } from '@carbon/react';
import { Help } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from './LocaleSelectorModal';

const DEFAULT_AI_EXPLANATION =
  'O Content Factory usa Inteligência Artificial para criar, revisar e sugerir melhorias nos seus posts. A IA lê o DNA da sua marca e gera conteúdo alinhado ao seu tom de voz, formato e estratégia de canal — do texto às hashtags.';

export default function PageLayout({
  pageName,
  pageDescription,
  itemCount,
  actions,
  helpMode,
  aiExplanation,
  children,
}: {
  pageName: string;
  pageDescription?: string;
  itemCount?: number;
  actions?: ReactNode;
  helpMode?: boolean;
  aiExplanation?: string;
  children: ReactNode;
}) {
  const { me } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  const tenantName = me.tenant?.name || 'Cestari Studio';

  // H3: "Content Factory | Posts" or include count: "Content Factory | 20 posts"
  const h3 = itemCount != null
    ? `${pageName} | ${itemCount.toLocaleString()} posts`
    : pageName;

  return (
    <div className="page-layout-container">
      {/* ─── Custom Page Header ─────────────────────────────────────────── */}
      <div className="gen-page-header">
        <div className="gen-page-header__left">
          {/* AI token + post usage badges — top left */}
          {me.usage && (
            <div className="gen-page-header__badges">
              <AILabel autoAlign kind="inline" size="sm" textLabel={`${me.usage.tokens_used.toLocaleString()} / ${me.usage.tokens_limit.toLocaleString()} tokens`}>
                <AILabelContent>
                  <div className="gen-ai-popover">
                    <p className="gen-ai-popover__label">Consumo de Tokens de IA</p>
                    <p className="gen-ai-popover__value">
                      {me.usage.tokens_used.toLocaleString()} usados de {me.usage.tokens_limit.toLocaleString()} disponíveis neste ciclo.
                    </p>
                    <p className="gen-ai-popover__status" data-ok={(me.usage.tokens_limit - me.usage.tokens_used) > 0}>
                      {(me.usage.tokens_limit - me.usage.tokens_used) > 0
                        ? `${(me.usage.tokens_limit - me.usage.tokens_used).toLocaleString()} tokens restantes`
                        : 'Limite atingido'}
                    </p>
                  </div>
                </AILabelContent>
              </AILabel>

              <AILabel autoAlign kind="inline" size="sm" textLabel={`${me.usage.posts_used} / ${me.usage.posts_limit} posts`}>
                <AILabelContent>
                  <div className="gen-ai-popover">
                    <p className="gen-ai-popover__label">Cota de Posts</p>
                    <p className="gen-ai-popover__value">
                      {me.usage.posts_used} posts publicados de {me.usage.posts_limit} disponíveis neste ciclo.
                    </p>
                    <p className="gen-ai-popover__status" data-ok={(me.usage.posts_limit - me.usage.posts_used) > 0}>
                      {(me.usage.posts_limit - me.usage.posts_used) > 0
                        ? `${me.usage.posts_limit - me.usage.posts_used} posts restantes`
                        : 'Limite de posts atingido'}
                    </p>
                  </div>
                </AILabelContent>
              </AILabel>
            </div>
          )}
        </div>

        {/* AI badge or Help — top right */}
        <div className="gen-page-header__right">
          {helpMode ? (
            <IconButton
              label={t('helpBadgeTooltip') || 'Ajuda'}
              kind="ghost"
              size="sm"
              onClick={() => setHelpOpen(true)}
            >
              <Help />
            </IconButton>
          ) : (
            <AILabel autoAlign kind="inline" size="sm">
              <AILabelContent>
                <div className="gen-ai-popover" style={{ maxWidth: '22rem' }}>
                  <p className="gen-ai-popover__label">IA no Content Factory</p>
                  <p className="gen-ai-popover__value" style={{ lineHeight: 1.6 }}>
                    {aiExplanation || DEFAULT_AI_EXPLANATION}
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
          )}
          {actions}
        </div>
      </div>

      {/* ─── H4 / H3 / P block ─────────────────────────────────────────── */}
      <div className="gen-page-title-block">
        <p className="gen-page-title-block__tenant">{tenantName}</p>
        <h3 className="gen-page-title-block__heading">{h3}</h3>
        {pageDescription && (
          <p className="gen-page-title-block__desc">{pageDescription}</p>
        )}
      </div>

      {/* ─── Help Modal ────────────────────────────────────────────────── */}
      {helpMode && (
        <Modal
          open={helpOpen}
          onRequestClose={() => setHelpOpen(false)}
          modalHeading={t('helpModalTitle')}
          passiveModal
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
              {t('helpModalDesc')}
            </p>
            <div>
              <strong>{t('helpModalEmail')}</strong>
              <br />
              <Link href="mailto:support@cestari.studio">support@cestari.studio</Link>
            </div>
            <div>
              <strong>{t('helpModalDocs')}</strong>
              <br />
              <Link href="https://docs.cestari.studio" target="_blank" rel="noopener">
                docs.cestari.studio
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Content ───────────────────────────────────────────────────── */}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
}
