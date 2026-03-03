// genOS Lumina — Carbon Notification Provider (Addendum H §11)
// Replaces custom popupNotifications.js with Carbon components:
//   Type A (toast)      → ToastNotification
//   Type B (persistent) → ActionableNotification
//   Type C (modal)      → ComposedModal
//   Type D (banner)     → ActionableNotification inline
import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ToastNotification,
  ActionableNotification,
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

interface PopupAction {
  label: string;
  type: string;
  action: string;
  target?: string;
}

interface PopupEvent {
  id: string;
  popup_code: string;
  category: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  persistence: 'toast' | 'persistent' | 'modal' | 'banner';
  actions: PopupAction[];
  has_upsell: boolean;
  upsell_type: string | null;
  upsell_product: string | null;
  created_at: string;
}

type NotificationKind = 'info' | 'success' | 'warning' | 'error';

interface NotificationContextValue {
  showToast: (title: string, message: string, kind?: NotificationKind) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  showToast: () => { },
});

export const useNotifications = () => useContext(NotificationContext);

const POLL_INTERVAL = 30_000;
const TOAST_DURATION = 8_000;

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [modalPopup, setModalPopup] = useState<PopupEvent | null>(null);

  // Poll for pending popups
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const tenantId = api.getActiveTenantId();
        if (!tenantId) return;
        const { data } = await supabase
          .from('popup_events')
          .select('*')
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);
        if (Array.isArray(data) && data.length > 0) {
          const modals = data.filter((p: any) => p.persistence === 'modal');
          const others = data.filter((p: any) => p.persistence !== 'modal');
          // Only set modal if not already showing one (avoid re-open loop)
          if (modals.length > 0) {
            setModalPopup(prev => prev ? prev : modals[0] as PopupEvent);
          }
          // Merge new popups, dedup by ID to prevent accumulation
          setPopups(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newOnes = (others as PopupEvent[]).filter(o => !existingIds.has(o.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        }
      } catch {
        // Silent fail — never break UI
      }
    };

    const timeout = setTimeout(fetchPending, 3000);
    const interval = setInterval(fetchPending, POLL_INTERVAL);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    const toasts = popups.filter(p => p.persistence === 'toast');
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      setPopups(prev => prev.filter(p => p.persistence !== 'toast' || !toasts.find(t => t.id === p.id)));
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [popups]);

  const recordAction = async (popupId: string, actionTaken: string) => {
    try {
      await supabase
        .from('popup_events')
        .update({ status: 'acted', action_taken: actionTaken, acted_at: new Date().toISOString() })
        .eq('id', popupId);
    } catch {
      // Silent
    }
  };

  const recordConversion = async (popupId: string, addonSlug: string) => {
    try {
      await supabase
        .from('popup_events')
        .update({ status: 'converted', action_taken: `upsell:${addonSlug}`, acted_at: new Date().toISOString() })
        .eq('id', popupId);
    } catch {
      // Silent
    }
  };

  const dismissPopup = (id: string) => {
    recordAction(id, 'dismiss');
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  const handleAction = (popup: PopupEvent, action: PopupAction) => {
    recordAction(popup.id, action.label);

    if (action.action === 'navigate' && action.target) {
      const normalized = action.target
        .replace('/index.html', '/')
        .replace('/factory.html', '/factory')
        .replace('/csv-browser.html', '/csv-browser')
        .replace('/brand-dna.html', '/brand-dna')
        .replace('/schedule.html', '/schedule')
        .replace('/observatory.html', '/observatory')
        .replace('/observatory-pricing.html', '/observatory/pricing')
        .replace('/settings.html', '/settings');
      navigate(normalized);
    } else if (action.action === 'upsell' && action.target) {
      recordConversion(popup.id, action.target);
    }

    dismissPopup(popup.id);
  };

  const showToast = useCallback((title: string, message: string, kind: NotificationKind = 'info') => {
    const fakePopup: PopupEvent = {
      id: `local-${Date.now()}`,
      popup_code: 'local',
      category: 'system_onboarding',
      title,
      message,
      severity: kind,
      persistence: 'toast',
      actions: [],
      has_upsell: false,
      upsell_type: null,
      upsell_product: null,
      created_at: new Date().toISOString(),
    };
    setPopups(prev => [...prev, fakePopup]);
  }, []);

  const mapKind = (severity: string): NotificationKind => {
    if (severity === 'success' || severity === 'warning' || severity === 'error') return severity;
    return 'info';
  };

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}

      {/* Toast + Persistent + Banner notifications container */}
      <div className="genos-notifications-container">
        {popups.map(popup => {
          if (popup.persistence === 'toast') {
            return (
              <ToastNotification
                key={popup.id}
                kind={mapKind(popup.severity)}
                title={popup.title}
                subtitle={popup.message}
                caption={new Date(popup.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                onCloseButtonClick={() => dismissPopup(popup.id)}
                lowContrast={false}
              />
            );
          }

          // Persistent + Banner → ActionableNotification
          return (
            <ActionableNotification
              key={popup.id}
              kind={mapKind(popup.severity)}
              title={popup.title}
              subtitle={popup.message}
              actionButtonLabel={popup.actions[0]?.label || 'Ver mais'}
              onActionButtonClick={() => {
                if (popup.actions[0]) handleAction(popup, popup.actions[0]);
              }}
              onCloseButtonClick={() => dismissPopup(popup.id)}
              lowContrast={false}
              inline={popup.persistence === 'banner'}
            />
          );
        })}
      </div>

      {/* Modal notifications → ComposedModal */}
      {modalPopup && (
        <ComposedModal
          open
          onClose={() => {
            dismissPopup(modalPopup.id);
            setModalPopup(null);
          }}
          size="sm"
        >
          <ModalHeader title={modalPopup.title} />
          <ModalBody>
            <p>{modalPopup.message}</p>
            {modalPopup.has_upsell && modalPopup.upsell_product && (
              <p className="notification-upsell">
                {modalPopup.upsell_type === 'trial' ? 'Trial disponivel' :
                  modalPopup.upsell_type === 'addon' ? 'Addon sugerido' : 'Upgrade sugerido'}
                : {modalPopup.upsell_product}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              kind="secondary"
              onClick={() => {
                dismissPopup(modalPopup.id);
                setModalPopup(null);
              }}
            >
              Fechar
            </Button>
            {modalPopup.actions.map((action, i) => (
              <Button
                key={i}
                kind={action.type === 'danger' ? 'danger' : i === 0 ? 'primary' : 'secondary'}
                onClick={() => {
                  handleAction(modalPopup, action);
                  setModalPopup(null);
                }}
              >
                {action.label}
              </Button>
            ))}
          </ModalFooter>
        </ComposedModal>
      )}
    </NotificationContext.Provider>
  );
}
