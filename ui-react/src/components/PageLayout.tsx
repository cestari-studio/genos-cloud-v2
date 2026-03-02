import { useState, type ReactNode } from 'react';
import { Grid, Column, Modal, Link, AILabel, AILabelContent, IconButton } from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';
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

  // Build subtitle: "20 posts | genOS | Content Factory"
  const subtitle = [
    itemCount != null ? `${itemCount.toLocaleString()} posts` : null,
    pageName,
    pageDescription
  ].filter(Boolean).join(' | ');

  return (
    <div className="page-layout-container">
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
            <AILabel autoAlign kind="inline" size="sm">
              <AILabelContent>
                <div style={{ padding: '1rem', maxWidth: '22rem' }}>
                  <p style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    IA no Content Factory
                  </p>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {aiExplanation || DEFAULT_AI_EXPLANATION}
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
