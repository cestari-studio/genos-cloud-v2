import { useState, type ReactNode } from 'react';
import { Modal, Link, AILabel, AILabelContent, IconButton } from '@carbon/react';
import { Help } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { t, getLocale } from './LocaleSelectorModal';

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

  return (
    <div className="page-layout-container">
      {/* ─── Top action bar (badges + right controls) ──────────────────── */}
      <div className="gen-page-header">
        <div className="gen-page-header__left">
          {usage && (
            <div className="gen-page-header__badges">
              {/* ── Tokens badge ── */}
              <AILabel autoAlign kind="inline" size="sm"
                textLabel={`${usage.tokens_used.toLocaleString(getLocale())} / ${usage.tokens_limit.toLocaleString(getLocale())} tokens`}
              >
                <AILabelContent>
                  <div className="ai-badge-popover">
                    <div className="ai-badge-popover__header">
                      <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                      <h4 className="ai-badge-popover__title">{t('aiTokensTitle')}</h4>
                    </div>
                    <div className="ai-badge-popover__meter-block">
                      <div className="ai-badge-popover__big-number">{100 - tokenPct}%</div>
                      <p className="ai-badge-popover__status" data-ok={usage.tokens_used < usage.tokens_limit}>
                        {usage.tokens_used < usage.tokens_limit
                          ? `${(usage.tokens_limit - usage.tokens_used).toLocaleString(getLocale())} ${t('aiTokensRemaining')}`
                          : t('aiTokensLimitReached')}
                      </p>
                      <div className="ai-badge-popover__progress-track">
                        <div className="ai-badge-popover__progress-fill" style={{ width: `${tokenPct}%` }} />
                      </div>
                    </div>
                    <p className="ai-badge-popover__desc">{t('aiTokensDesc')}</p>
                    <div className="ai-badge-popover__divider" />
                    <div className="ai-badge-popover__stats">
                      <div className="ai-badge-popover__stat">
                        <span className="ai-badge-popover__stat-label">{t('aiTokensUsed')}</span>
                        <span className="ai-badge-popover__stat-value">{usage.tokens_used.toLocaleString(getLocale())}</span>
                      </div>
                      <div className="ai-badge-popover__stat">
                        <span className="ai-badge-popover__stat-label">{t('aiCurrentCycle')}</span>
                        <span className="ai-badge-popover__stat-value">
                          {new Date().toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </AILabelContent>
              </AILabel>

              {/* ── Posts badge ── */}
              <AILabel autoAlign kind="inline" size="sm"
                textLabel={`${usage.posts_used} / ${usage.posts_limit} posts`}
              >
                <AILabelContent>
                  <div className="ai-badge-popover">
                    <div className="ai-badge-popover__header">
                      <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                      <h4 className="ai-badge-popover__title">{t('aiPostsTitle')}</h4>
                    </div>
                    <div className="ai-badge-popover__meter-block">
                      <div className="ai-badge-popover__big-number">{100 - postPct}%</div>
                      <p className="ai-badge-popover__status" data-ok={usage.posts_used < usage.posts_limit}>
                        {usage.posts_used < usage.posts_limit
                          ? `${usage.posts_limit - usage.posts_used} ${t('aiPostsRemaining')}`
                          : t('aiPostsLimitReached')}
                      </p>
                      <div className="ai-badge-popover__progress-track">
                        <div className="ai-badge-popover__progress-fill" style={{ width: `${postPct}%` }} />
                      </div>
                    </div>
                    <p className="ai-badge-popover__desc">{t('aiPostsDesc')}</p>
                    <div className="ai-badge-popover__divider" />
                    <div className="ai-badge-popover__stats">
                      <div className="ai-badge-popover__stat">
                        <span className="ai-badge-popover__stat-label">{t('aiPostsUsed')}</span>
                        <span className="ai-badge-popover__stat-value">{usage.posts_used}</span>
                      </div>
                      <div className="ai-badge-popover__stat">
                        <span className="ai-badge-popover__stat-label">{t('aiCurrentCycle')}</span>
                        <span className="ai-badge-popover__stat-value">
                          {new Date().toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </AILabelContent>
              </AILabel>
            </div>
          )}
        </div>

        {/* ── Top right: AI label or Help ── */}
        <div className="gen-page-header__right">
          {helpMode ? (
            <IconButton label={t('helpBadgeTooltip')} kind="ghost" size="sm" onClick={() => setHelpOpen(true)}>
              <Help />
            </IconButton>
          ) : (
            <AILabel align="bottom-right" kind="inline" size="sm">
              <AILabelContent>
                <div className="ai-badge-popover" style={{ maxWidth: '22rem' }}>
                  <div className="ai-badge-popover__header">
                    <span className="ai-badge-popover__eyebrow">{t('aiBadgeLabel')}</span>
                    <h4 className="ai-badge-popover__title">{t('aiContentFactoryTitle')}</h4>
                  </div>
                  <p className="ai-badge-popover__desc">
                    {aiExplanation || t('aiContentFactoryDesc')}
                  </p>
                  <div className="ai-badge-popover__divider" />
                  <p className="ai-badge-popover__features">
                    {t('aiContentFactoryFeatures')}
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
          )}
          {actions}
        </div>
      </div>

      {/* ─── H4 / H3 / P title block ───────────────────────────────────── */}
      <div className="gen-page-title-block">
        <h4 className="gen-page-title-block__tenant">{tenantName}</h4>
        <h4 className="gen-page-title-block__heading">{h3}</h4>
        {pageDescription && (
          <p className="gen-page-title-block__desc">{pageDescription}</p>
        )}
      </div>

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
