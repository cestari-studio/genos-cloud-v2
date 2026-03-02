import { useState, type ReactNode } from 'react';
import { Grid, Column, Modal, Link, AILabel, AILabelContent, IconButton } from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
import { Help } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from './LocaleSelectorModal';

export default function PageLayout({
  pageSubtitle,
  itemCount,
  actions,
  helpMode,
  children,
}: {
  pageSubtitle: string;
  itemCount?: number;
  actions?: ReactNode;
  helpMode?: boolean;
  children: ReactNode;
}) {
  const { me } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  const tenantName = me.tenant?.name || 'Cestari Studio';
  const credits = me.wallet?.credits ?? 0;
  const maxCredits = 5000;

  // Build subtitle: "19 posts | genOS - Content Factory"
  const subtitle = itemCount != null
    ? `${itemCount} posts | ${pageSubtitle}`
    : pageSubtitle;

  return (
    <div className="page-layout-container">
      {/* ─── AI Token Badge (inline, top-left) ─────────────────────────── */}
      <div style={{ padding: '0.75rem 1rem 0', display: 'flex', alignItems: 'center' }}>
        <AILabel autoAlign kind="inline" size="sm">
          <AILabelContent>
            <div style={{ padding: '0.75rem' }}>
              <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                AI Token Usage
              </p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {credits.toLocaleString()} / {maxCredits.toLocaleString()}
              </p>
              <p style={{ color: credits > 0 ? 'var(--cds-support-success)' : 'var(--cds-support-error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {credits > 0 ? 'Tokens disponíveis' : 'Sem tokens'}
              </p>
            </div>
          </AILabelContent>
        </AILabel>
      </div>

      {/* ─── Page Header ───────────────────────────────────────────────── */}
      <PageHeader
        title={tenantName}
        subtitle={subtitle}
        className="gen-os-master-header"
      >
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
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
            <AILabel autoAlign size="xl">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    AI Powered
                  </p>
                  <p style={{ fontSize: '0.875rem' }}>
                    {t('factoryAiExplained') || 'Conteúdo gerado e avaliado por modelos de IA.'}
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
          )}
          {actions}
        </div>
      </PageHeader>

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
      <div className="page-content" style={{ marginTop: '2rem' }}>
        <Grid fullWidth className="page-grid">
          <Column sm={4} md={8} lg={16}>
            {children}
          </Column>
        </Grid>
      </div>
    </div>
  );
}
