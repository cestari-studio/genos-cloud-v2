import { useState, type ReactNode } from 'react';
import { Modal, Link, AILabel, AILabelContent, IconButton, Button } from '@carbon/react';
import { Help } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { t, getLocale } from '../config/locale';
import { useCanGenerate } from '../hooks/useCanGenerate';
import { Tag } from '@carbon/react';
import { UsageDetailPanel } from './UsageDetailPanel';

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
  const { isLowBalance, tokensRemaining } = useCanGenerate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [showUsagePanel, setShowUsagePanel] = useState(false);

  const tenantName = me.tenant?.name || 'Cestari Studio';
  const usage = me.usage;

  const h3 = itemCount != null
    ? `${pageName} | ${itemCount.toLocaleString(getLocale())} posts`
    : pageName;

  const tokenPct = usage
    ? Math.min(100, Math.round((usage.tokens_used / Math.max(1, usage.tokens_limit)) * 100))
    : 0;
  const postPct = usage
    ? Math.min(100, Math.round((usage.posts_used / Math.max(1, usage.posts_limit)) * 100))
    : 0;
  const schedulePct = usage
    ? Math.min(100, Math.round((usage.schedule_used / Math.max(1, usage.schedule_limit)) * 100))
    : 0;

  // Usage badge coloring logic
  const getBadgeType = (pct: number) => {
    const remaining = 100 - pct;
    if (remaining <= 0) return 'red';
    if (remaining < 20) return 'magenta';
    if (remaining < 50) return 'warm-gray';
    return 'green';
  };

  return (
    <div className="page-layout-container">
      {/* ─── Usage Detail Panel ────────────────────────────────────────── */}
      {me.tenant?.id && (
        <UsageDetailPanel
          isOpen={showUsagePanel}
          onClose={() => setShowUsagePanel(false)}
          tenantId={me.tenant.id}
        />
      )}

      {/* ─── Top absolute actions (AI Label & Actions) ────────────────── */}
      <div className="gen-page-actions-top">
        {helpMode ? (
          <IconButton label={t('helpBadgeTooltip')} kind="ghost" size="sm" onClick={() => setHelpOpen(true)}>
            <Help />
          </IconButton>
        ) : (
          <AILabel autoAlign kind="default" size="sm" className="ai-label-header-btn">
            <AILabelContent>
              <div className="ai-label-popover-page">
                <p className="cds--type-label-01 ai-label-popover-page__category">
                  {t('aiBadgeLabel')}
                </p>
                <h4 className="cds--type-productive-heading-02 ai-label-popover-page__title">
                  {t('aiContentFactoryTitle')}
                </h4>
                <p className="cds--type-body-short-01 ai-label-popover-page__body">
                  {aiExplanation || t('aiContentFactoryDesc')}
                </p>

                <hr className="ai-label-popover-page__divider" />

                <p className="cds--type-helper-text-01">
                  {t('aiContentFactoryFeatures')}
                </p>
              </div>
            </AILabelContent>
          </AILabel>
        )}
        {actions}
      </div>

      {/* ─── H4 / H3 / P title block ───────────────────────────────────── */}
      <div className="gen-page-title-block">
        <h4 className="gen-page-title-block__tenant cds--label">{tenantName}</h4>
        <h3 className="gen-page-title-block__heading">{h3}</h3>

        {pageDescription && (
          <p className="gen-page-title-block__desc">{pageDescription}</p>
        )}

        {usage && (
          <div className="gen-page-header__badges" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {tokensRemaining <= 0 ? (
              <Tag type="red" size="sm" title="Tokens Esgotados" className="pulse-red">ESGOTADO</Tag>
            ) : isLowBalance ? (
              <Tag type="magenta" size="sm" title="Tokens Baixos">EQUILÍBRIO BAIXO</Tag>
            ) : null}

            {/* ── Tokens badge (AILabel Inline) ── */}
            <div onClick={() => setShowUsagePanel(true)} style={{ cursor: 'pointer' }}>
              <AILabel
                autoAlign
                kind="inline"
                size="sm"
                textLabel={`Tokens: ${usage.tokens_limit - usage.tokens_used}`}
              >
                <AILabelContent>
                  <div className="ai-label-popover-badge">
                    <p className="cds--type-label-01">IA EXPLAINED</p>
                    <p className="cds--type-body-short-01">
                      O consumo de tokens é calculado com base no modelo <strong>{me.config?.ai_model || 'Gemini'}</strong>.
                      Este saldo é debitado a cada geração de conteúdo ou revisão solicitada.
                    </p>
                    <Button kind="ghost" size="sm" onClick={() => setShowUsagePanel(true)} className="ai-label-popover-badge__link">
                      Ver histórico de uso →
                    </Button>
                  </div>
                </AILabelContent>
              </AILabel>
            </div>

            {/* ── Posts badge (AILabel Inline) ── */}
            <div onClick={() => setShowUsagePanel(true)} style={{ cursor: 'pointer' }}>
              <AILabel
                autoAlign
                kind="inline"
                size="sm"
                textLabel={`Posts: ${usage.posts_used}/${usage.posts_limit}`}
              >
                <AILabelContent>
                  <div className="ai-label-popover-badge">
                    <p className="cds--type-label-01">IA EXPLAINED</p>
                    <p className="cds--type-body-short-01">
                      Este é o seu limite mensal de posts gerados por Inteligência Artificial no plano <strong>{me.tenant?.plan || 'Standard'}</strong>.
                    </p>
                    <Button kind="ghost" size="sm" onClick={() => setShowUsagePanel(true)} className="ai-label-popover-badge__link">
                      Saber mais sobre posts →
                    </Button>
                  </div>
                </AILabelContent>
              </AILabel>
            </div>

            {/* ── Schedule badge ── */}
            {me.config?.schedule_enabled && (
              <div onClick={() => setShowUsagePanel(true)} style={{ cursor: 'pointer' }}>
                <AILabel
                  autoAlign
                  kind="inline"
                  size="sm"
                  textLabel={`Schedule: ${usage.schedule_used}/${usage.schedule_limit}`}
                >
                  <AILabelContent>
                    <div className="ai-label-popover-badge">
                      <p className="cds--type-label-01">IA EXPLAINED</p>
                      <p className="cds--type-body-short-01">
                        Limite de agendamentos automáticos para o ciclo atual.
                      </p>
                    </div>
                  </AILabelContent>
                </AILabel>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="gen-page-spacer" />

      {/* ─── Help Modal ─────────────────────────────────────────────────── */}
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
              <strong>{t('helpModalEmail')}</strong><br />
              <Link href="mailto:support@cestari.studio">support@cestari.studio</Link>
            </div>
            <div>
              <strong>{t('helpModalDocs')}</strong><br />
              <Link href="https://docs.cestari.studio" target="_blank" rel="noopener">docs.cestari.studio</Link>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Page content ───────────────────────────────────────────────── */}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
}
