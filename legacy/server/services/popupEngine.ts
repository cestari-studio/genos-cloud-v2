// genOS Full v1.0.0 "Lumina" — popupEngine.ts (Addendum F)
// Autonomous Intelligence Popup Engine — emit, rate-limit, dedup, query

import { supabase } from './supabaseClient';
import { emitFeedEvent } from './activityFeed';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PopupCategory =
  | 'autonomous_content'
  | 'insights_analytics'
  | 'maintenance'
  | 'commercial'
  | 'system_onboarding'
  | 'social_proof';

export type PopupSeverity = 'info' | 'success' | 'warning' | 'error';
export type PopupPersistence = 'toast' | 'persistent' | 'modal' | 'banner';
export type PopupActionType = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type PopupActionBehavior = 'navigate' | 'dismiss' | 'upsell' | 'api_call' | 'confirm';
export type UpsellKind = 'addon' | 'upgrade' | 'service' | 'trial' | 'package';

export interface PopupAction {
  label: string;
  type: PopupActionType;
  action: PopupActionBehavior;
  target?: string;
}

export interface PopupUpsell {
  type: UpsellKind;
  product: string; // slug from addons_catalog
}

export interface PopupPayload {
  tenantId: string;
  code: string; // e.g. 'A1', 'B4', 'D5'
  category: PopupCategory;
  title: string;
  message: string;
  severity?: PopupSeverity;
  persistence?: PopupPersistence;
  actions: PopupAction[];
  upsell?: PopupUpsell;
  triggerData?: Record<string, unknown>;
  ttlHours?: number;
}

export interface PopupEvent {
  id: string;
  tenant_id: string;
  popup_code: string;
  category: PopupCategory;
  title: string;
  message: string;
  severity: PopupSeverity;
  persistence: PopupPersistence;
  actions: PopupAction[];
  has_upsell: boolean;
  upsell_type: UpsellKind | null;
  upsell_product: string | null;
  status: string;
  action_taken: string | null;
  displayed_at: string | null;
  acted_at: string | null;
  trigger_data: Record<string, unknown>;
  ttl_hours: number;
  created_at: string;
}

// ─── PopupEngine ────────────────────────────────────────────────────────────

class PopupEngine {
  // Rate limiting: max 3 non-toast popups per tenant per hour
  private readonly MAX_PER_HOUR = 3;

  // Cooldown: same popup code won't repeat within 24h
  private readonly COOLDOWN_HOURS = 24;

  /**
   * Emit a popup event with rate limiting, cooldown, and upsell dedup.
   */
  async emit(payload: PopupPayload): Promise<{ emitted: boolean; reason?: string }> {
    try {
      // 1. Cooldown check — same popup code within 24h
      const cooldownCutoff = new Date(Date.now() - this.COOLDOWN_HOURS * 3600000).toISOString();
      const { data: recent } = await supabase
        .from('popup_events')
        .select('id')
        .eq('tenant_id', payload.tenantId)
        .eq('popup_code', payload.code)
        .gte('created_at', cooldownCutoff)
        .limit(1);

      if (recent?.length) {
        return { emitted: false, reason: 'cooldown' };
      }

      // 2. Rate limit check (except toasts)
      if (payload.persistence !== 'toast') {
        const hourCutoff = new Date(Date.now() - 3600000).toISOString();
        const { data: hourly } = await supabase
          .from('popup_events')
          .select('id')
          .eq('tenant_id', payload.tenantId)
          .neq('persistence', 'toast')
          .gte('created_at', hourCutoff);

        if ((hourly?.length || 0) >= this.MAX_PER_HOUR) {
          return { emitted: false, reason: 'rate_limited' };
        }
      }

      // 3. Upsell dedup — don't offer what tenant already has
      let finalUpsell = payload.upsell;
      let finalActions = payload.actions;

      if (finalUpsell) {
        const { data: addonRow } = await supabase
          .from('addons_catalog')
          .select('id')
          .eq('slug', finalUpsell.product)
          .single();

        if (addonRow) {
          const { data: hasAddon } = await supabase
            .from('tenant_addons')
            .select('id')
            .eq('tenant_id', payload.tenantId)
            .eq('addon_id', addonRow.id)
            .in('status', ['active', 'trial'])
            .limit(1);

          if (hasAddon?.length) {
            // Remove upsell — tenant already has this addon
            finalUpsell = undefined;
            finalActions = finalActions.filter(a => a.action !== 'upsell');
          }
        }
      }

      // 4. Insert popup event
      const { error } = await supabase.from('popup_events').insert({
        tenant_id: payload.tenantId,
        popup_code: payload.code,
        category: payload.category,
        title: payload.title,
        message: payload.message,
        severity: payload.severity || 'info',
        persistence: payload.persistence || 'persistent',
        actions: finalActions,
        has_upsell: !!finalUpsell,
        upsell_type: finalUpsell?.type || null,
        upsell_product: finalUpsell?.product || null,
        trigger_data: payload.triggerData || {},
        ttl_hours: payload.ttlHours || 72,
        status: 'pending',
      });

      if (error) {
        console.error('[popupEngine] Insert error:', error.message);
        return { emitted: false, reason: error.message };
      }

      // 5. Log to Activity Feed
      await emitFeedEvent({
        tenant_id: payload.tenantId,
        category: 'system',
        action: `popup_emitted:${payload.code}`,
        severity: payload.severity || 'info',
        summary: payload.title,
        detail: payload.message.slice(0, 200),
        is_autonomous: true,
        show_toast: false,
      });

      return { emitted: true };
    } catch (err) {
      console.error('[popupEngine] Error emitting popup:', err);
      return { emitted: false, reason: String(err) };
    }
  }

  /**
   * Get pending popups for a tenant (frontend polling).
   * Marks returned popups as 'displayed'.
   */
  async getPending(tenantId: string): Promise<PopupEvent[]> {
    const { data, error } = await supabase
      .from('popup_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[popupEngine] getPending error:', error.message);
      return [];
    }

    if (data?.length) {
      const ids = data.map((d: any) => d.id);
      await supabase
        .from('popup_events')
        .update({ status: 'displayed', displayed_at: new Date().toISOString() })
        .in('id', ids);
    }

    return (data as PopupEvent[]) || [];
  }

  /**
   * Record user action on a popup.
   */
  async recordAction(popupId: string, actionTaken: string): Promise<void> {
    const newStatus = actionTaken === 'dismiss' ? 'dismissed' : 'action_taken';
    const { error } = await supabase
      .from('popup_events')
      .update({
        status: newStatus,
        action_taken: actionTaken,
        acted_at: new Date().toISOString(),
      })
      .eq('id', popupId);

    if (error) {
      console.error('[popupEngine] recordAction error:', error.message);
    }
  }

  /**
   * Record upsell conversion from a popup.
   */
  async recordConversion(popupId: string, addonSlug: string, tenantId: string): Promise<void> {
    // Mark popup as converted
    const { error: updateErr } = await supabase
      .from('popup_events')
      .update({ status: 'converted', acted_at: new Date().toISOString() })
      .eq('id', popupId);

    if (updateErr) {
      console.error('[popupEngine] recordConversion update error:', updateErr.message);
    }

    // Optionally activate addon trial
    const { data: addon } = await supabase
      .from('addons_catalog')
      .select('id, trial_days')
      .eq('slug', addonSlug)
      .single();

    if (addon) {
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + (addon.trial_days || 7));

      await supabase.from('tenant_addons').upsert(
        {
          tenant_id: tenantId,
          addon_id: addon.id,
          status: 'trial',
          trial_ends_at: trialEnds.toISOString(),
          activated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,addon_id' }
      );
    }
  }

  /**
   * Expire old popups past their TTL (called by daily cron).
   */
  async expireOld(): Promise<number> {
    const { data, error } = await supabase.rpc('expire_old_popups');
    if (error) {
      console.error('[popupEngine] expireOld error:', error.message);
      return 0;
    }
    return 0; // RPC returns void
  }

  /**
   * Get popup analytics for Observatory.
   */
  async getAnalytics(): Promise<any[]> {
    const { data, error } = await supabase
      .from('observatory_popup_analytics')
      .select('*');

    if (error) {
      console.error('[popupEngine] getAnalytics error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get popup revenue analytics for Observatory.
   */
  async getRevenue(): Promise<any[]> {
    const { data, error } = await supabase
      .from('observatory_popup_revenue')
      .select('*');

    if (error) {
      console.error('[popupEngine] getRevenue error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get addons catalog.
   */
  async getAddonsCatalog(activeOnly: boolean = true): Promise<any[]> {
    let query = supabase.from('addons_catalog').select('*').order('category, name');
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) {
      console.error('[popupEngine] getAddonsCatalog error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get tenant addons (what a tenant currently has).
   */
  async getTenantAddons(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tenant_addons')
      .select('*, addon:addons_catalog(*)')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trial']);

    if (error) {
      console.error('[popupEngine] getTenantAddons error:', error.message);
      return [];
    }
    return data || [];
  }
}

// Singleton export
export const popupEngine = new PopupEngine();
