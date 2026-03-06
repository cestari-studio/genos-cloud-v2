import { useState } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tile,
  Tag,
  Button,
} from '@carbon/react';
import { Earth } from '@carbon/icons-react';

interface LocaleSelectorModalProps {
  open: boolean;
  onClose: () => void;
  tenantName: string;
}

import { LocaleConfig, LOCALES, getLocale, t, i18n } from '@/config/locale';

export default function LocaleSelectorModal({ open, onClose, tenantName }: LocaleSelectorModalProps) {
  const currentLocale = getLocale();
  const [selected, setSelected] = useState(currentLocale);

  const handleSave = () => {
    localStorage.setItem('genOS_locale', selected);
    document.documentElement.lang = selected;
    onClose();
    window.location.reload();
  };

  const strings = i18n[selected] || i18n['pt-BR'];

  return (
    <ComposedModal open={open} onClose={onClose} preventCloseOnClickOutside size="sm">
      <ModalHeader title={strings.regionTitle} closeModal={onClose} />
      <ModalBody>
        <p className="cds--type-body-short-01" style={{ marginBottom: '1.5rem', color: 'var(--cds-text-secondary)' }}>
          {strings.regionDesc}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {LOCALES.map((loc) => (
            <Tile
              key={loc.id}
              onClick={() => setSelected(loc.langCode)}
              style={{
                backgroundColor: selected === loc.langCode ? 'var(--cds-layer-02)' : 'var(--cds-layer-01)',
                border: selected === loc.langCode ? '1px solid var(--cds-interactive)' : '1px solid var(--cds-border-subtle-01)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                margin: 0,
                padding: '1rem',
              }}
            >
              <Earth size={24} fill={selected === loc.langCode ? 'var(--cds-interactive)' : '#8d8d8d'} />
              <div style={{ flex: 1 }}>
                <h4 className="cds--type-productive-heading-01" style={{ color: 'var(--cds-text-primary)' }}>
                  {loc.name}
                </h4>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                  <Tag size="sm" type="blue">{loc.langLabel}</Tag>
                  <Tag size="sm" type="teal">{loc.currency} {loc.currencySymbol}</Tag>
                </div>
              </div>
            </Tile>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>{strings.cancel}</Button>
        <Button kind="primary" onClick={handleSave}>{strings.save}</Button>
      </ModalFooter>
    </ComposedModal>
  );
}