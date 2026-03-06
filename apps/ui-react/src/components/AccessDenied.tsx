import { InlineNotification, Tile } from '@carbon/react';

export default function AccessDenied({ message }: { message?: string }) {
  return (
    <Tile className="page-card">
      <InlineNotification
        kind="error"
        title="Acesso negado"
        subtitle={message || 'Você não possui permissão para acessar este módulo.'}
      />
    </Tile>
  );
}
