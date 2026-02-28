import type { ReactNode } from 'react';
import { Grid, Column } from '@carbon/react';
import { PageHeader } from '@carbon/ibm-products';

export default function PageLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-layout-container">
      <PageHeader
        title={title}
        subtitle={subtitle}
        className="gen-os-master-header"
      >
        {actions && <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>{actions}</div>}
      </PageHeader>
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
