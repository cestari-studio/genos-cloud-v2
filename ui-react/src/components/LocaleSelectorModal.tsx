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

export interface LocaleConfig {
  id: string;
  name: string;
  langCode: string;
  langLabel: string;
  currency: string;
  currencySymbol: string;
}

export const LOCALES: LocaleConfig[] = [
  { id: 'br', name: 'Brasil', langCode: 'pt-BR', langLabel: 'PT-BR', currency: 'BRL', currencySymbol: 'R$' },
  { id: 'us', name: 'United States', langCode: 'en-US', langLabel: 'EN-US', currency: 'USD', currencySymbol: '$' },
  { id: 'uk', name: 'United Kingdom', langCode: 'en-GB', langLabel: 'EN-UK', currency: 'GBP', currencySymbol: '£' },
  { id: 'jp', name: 'Japan', langCode: 'ja-JP', langLabel: 'JP-JA', currency: 'JPY', currencySymbol: '¥' },
];

// ─── i18n strings per locale ─────────────────────────────────────────────────
export const i18n: Record<string, Record<string, string>> = {
  'pt-BR': {
    dashboard: 'Dashboard',
    contentFactory: 'Content Factory',
    posts: 'Posts',
    complianceAuditor: 'Compliance Auditor',
    brandDna: 'Brand DNA',
    semanticMap: 'Mapa Semântico',
    settings: 'Configurações',
    notifications: 'Notificações',
    noNotifications: 'Nenhuma notificação',
    loading: 'Carregando...',
    profile: 'Perfil',
    logout: 'Sair',
    tokensRemaining: 'Tokens restantes',
    currentCycle: 'Ciclo atual',
    regionTitle: 'Configuração Regional',
    regionDesc: 'Selecione seu idioma e região. A interface do sistema será traduzida automaticamente. O idioma das postagens é configurado separadamente em Configurações.',
    save: 'Salvar',
    cancel: 'Cancelar',
    viewDetail: 'Visualizar',
    additionalData: 'DADOS ADICIONAIS',
    notifDetail: 'Detalhes da Notificação',
  },
  'en-US': {
    dashboard: 'Dashboard',
    contentFactory: 'Content Factory',
    posts: 'Posts',
    complianceAuditor: 'Compliance Auditor',
    brandDna: 'Brand DNA',
    semanticMap: 'Semantic Map',
    settings: 'Settings',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    loading: 'Loading...',
    profile: 'Profile',
    logout: 'Sign out',
    tokensRemaining: 'Tokens remaining',
    currentCycle: 'Current cycle',
    regionTitle: 'Region Settings',
    regionDesc: 'Select your language and region. The system interface will be automatically translated. Post language is configured separately in Settings.',
    save: 'Save',
    cancel: 'Cancel',
    viewDetail: 'View',
    additionalData: 'ADDITIONAL DATA',
    notifDetail: 'Notification Details',
  },
  'en-GB': {
    dashboard: 'Dashboard',
    contentFactory: 'Content Factory',
    posts: 'Posts',
    complianceAuditor: 'Compliance Auditor',
    brandDna: 'Brand DNA',
    semanticMap: 'Semantic Map',
    settings: 'Settings',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    loading: 'Loading...',
    profile: 'Profile',
    logout: 'Sign out',
    tokensRemaining: 'Tokens remaining',
    currentCycle: 'Current cycle',
    regionTitle: 'Region Settings',
    regionDesc: 'Select your language and region. The system interface will be automatically translated. Post language is configured separately in Settings.',
    save: 'Save',
    cancel: 'Cancel',
    viewDetail: 'View',
    additionalData: 'ADDITIONAL DATA',
    notifDetail: 'Notification Details',
  },
  'ja-JP': {
    dashboard: 'ダッシュボード',
    contentFactory: 'コンテンツファクトリー',
    posts: '投稿',
    complianceAuditor: 'コンプライアンス監査',
    brandDna: 'ブランドDNA',
    semanticMap: 'セマンティックマップ',
    settings: '設定',
    notifications: '通知',
    noNotifications: '通知はありません',
    loading: '読み込み中...',
    profile: 'プロフィール',
    logout: 'ログアウト',
    tokensRemaining: '残りトークン',
    currentCycle: '現在のサイクル',
    regionTitle: '地域設定',
    regionDesc: '言語と地域を選択してください。システムインターフェースは自動的に翻訳されます。投稿言語は設定で個別に設定されます。',
    save: '保存',
    cancel: 'キャンセル',
    viewDetail: '表示',
    additionalData: '追加データ',
    notifDetail: '通知の詳細',
  },
};

/** Get saved locale or default to pt-BR */
export function getLocale(): string {
  return localStorage.getItem('genOS_locale') || 'pt-BR';
}

/** Get translation string */
export function t(key: string): string {
  const locale = getLocale();
  return i18n[locale]?.[key] || i18n['pt-BR']?.[key] || key;
}

/** Get the full locale config */
export function getLocaleConfig(): LocaleConfig {
  const locale = getLocale();
  return LOCALES.find(l => l.langCode === locale) || LOCALES[0];
}

export default function LocaleSelectorModal({ open, onClose, tenantName }: LocaleSelectorModalProps) {
  const currentLocale = getLocale();
  const [selected, setSelected] = useState(currentLocale);

  const handleSave = () => {
    localStorage.setItem('genOS_locale', selected);
    document.documentElement.lang = selected;
    onClose();
    // Reload to apply translations across the app
    window.location.reload();
  };

  const strings = i18n[selected] || i18n['pt-BR'];

  return (
    <ComposedModal open={open} onClose={onClose} preventCloseOnClickOutside size="sm">
      <ModalHeader title={strings.regionTitle} closeModal={onClose} />
      <ModalBody>
        <p className="cds--type-body-short-01" style={{ marginBottom: '1.5rem', color: '#c6c6c6' }}>
          {strings.regionDesc}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {LOCALES.map((loc) => (
            <Tile
              key={loc.id}
              onClick={() => setSelected(loc.langCode)}
              style={{
                backgroundColor: selected === loc.langCode ? '#393939' : '#262626',
                border: selected === loc.langCode ? '1px solid #0f62fe' : '1px solid #393939',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                margin: 0,
                padding: '1rem',
              }}
            >
              <Earth size={24} fill={selected === loc.langCode ? '#0f62fe' : '#8d8d8d'} />
              <div style={{ flex: 1 }}>
                <h4 className="cds--type-productive-heading-01" style={{ color: '#f4f4f4' }}>
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
