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
              <div style={{ padding: '0 1rem 1rem 1rem', maxWidth: '24rem', color: '#f4f4f4' }}>
                <p style={{ fontSize: '0.75rem', color: '#a8a8a8', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {t('aiBadgeLabel')}
                </p>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', lineHeight: 1.3 }}>
                  {t('aiContentFactoryTitle')}
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#c6c6c6', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                  {aiExplanation || t('aiContentFactoryDesc')}
                </p>

                <hr style={{ border: 'none', borderTop: '1px solid #393939', margin: '0 0 1rem 0' }} />

                <p style={{ fontSize: '0.875rem', color: '#a8a8a8', fontStyle: 'italic', lineHeight: 1.5 }}>
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

      </div>

      <div style={{ height: '60px' }} /> {/* 60px vertical spacing */}

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
