import { useState, type ReactNode } from 'react';
import { Grid, Column, Modal, Button, Link } from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
import { Help } from '@carbon/icons-react';
import { t } from './LocaleSelectorModal';

export default function PageLayout({
  title,
  subtitle,
  actions,
  helpMode,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  helpMode?: boolean;
  children: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="page-layout-container">
      <PageHeader
        title={title}
        subtitle={subtitle}
        className="gen-os-master-header"
      >
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
          {helpMode && (
            <button
              onClick={() => setHelpOpen(true)}
              title={t('helpBadgeTooltip')}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--cds-border-subtle)',
                background: 'var(--cds-layer-01)', color: 'var(--cds-text-secondary)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              <Help size={16} />
            </button>
          )}
          {actions}
        </div>
      </PageHeader>

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
