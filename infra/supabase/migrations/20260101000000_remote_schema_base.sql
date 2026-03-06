


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."media_status" AS ENUM (
    'pending',
    'uploaded',
    'approved'
);


ALTER TYPE "public"."media_status" OWNER TO "postgres";


CREATE TYPE "public"."media_type" AS ENUM (
    'image',
    'video'
);


ALTER TYPE "public"."media_type" OWNER TO "postgres";


CREATE TYPE "public"."post_format" AS ENUM (
    'feed',
    'carrossel',
    'stories',
    'reels'
);


ALTER TYPE "public"."post_format" OWNER TO "postgres";


CREATE TYPE "public"."post_status" AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'revision_requested',
    'published'
);


ALTER TYPE "public"."post_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_addon_package"("p_purchase_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_purchase addon_purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_purchase
  FROM addon_purchases
  WHERE id = p_purchase_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase % not found or not in approved status', p_purchase_id;
  END IF;
  -- Credit tokens to wallet
  UPDATE public.credit_wallets
  SET prepaid_credits = prepaid_credits + v_purchase.tokens_purchased,
      updated_at = now()
  WHERE tenant_id = v_purchase.tenant_id;
  -- Credit posts to tenant_config
  UPDATE public.tenant_config
  SET post_limit = post_limit + v_purchase.posts_purchased
  WHERE tenant_id = v_purchase.tenant_id;
  -- Mark purchase as applied
  UPDATE public.addon_purchases
  SET status = 'applied', applied_at = now()
  WHERE id = p_purchase_id;
  -- Activity log entry
  -- (Assuming activity_log exists as identified by linter)
  INSERT INTO public.activity_log (tenant_id, category, summary, detail)
  VALUES (
    v_purchase.tenant_id,
    'commercial',
    'Pacote adicional aplicado',
    format('+ %s tokens, + %s posts (compra #%s)',
      v_purchase.tokens_purchased,
      v_purchase.posts_purchased,
      p_purchase_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- Fallback if activity_log name is different or missing
  NULL;
END;
$$;


ALTER FUNCTION "public"."apply_addon_package"("p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_envelope jsonb;
  v_brand_dna jsonb;
  v_prompt record;
  v_rules jsonb;
  v_tenant record;
BEGIN
  -- Verify user has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: user is not a member of this tenant';
  END IF;

  -- Get tenant info
  SELECT name, slug, plan, settings INTO v_tenant
  FROM public.tenants WHERE id = p_tenant_id;

  -- Get Brand DNA
  v_brand_dna := public.get_brand_dna(p_tenant_id);

  -- Get active system prompt (by name or first active)
  IF p_prompt_name IS NOT NULL THEN
    SELECT * INTO v_prompt FROM public.system_prompts
    WHERE tenant_id = p_tenant_id AND name = p_prompt_name AND is_active = true
    LIMIT 1;
  ELSE
    SELECT * INTO v_prompt FROM public.system_prompts
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Get active compliance rules
  SELECT jsonb_agg(jsonb_build_object(
    'rule_type', rule_type,
    'rule_config', rule_config,
    'severity', severity
  )) INTO v_rules
  FROM public.compliance_rules
  WHERE tenant_id = p_tenant_id AND is_active = true;

  -- Build envelope
  v_envelope := jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', p_tenant_id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'plan', v_tenant.plan
    ),
    'brand_dna', COALESCE(v_brand_dna, '{}'::jsonb),
    'system_prompt', CASE 
      WHEN v_prompt IS NOT NULL THEN jsonb_build_object(
        'id', v_prompt.id,
        'name', v_prompt.name,
        'content', v_prompt.prompt_text,
        'model', v_prompt.model_target,
        'temperature', v_prompt.temperature
      )
      ELSE NULL
    END,
    'compliance_rules', COALESCE(v_rules, '[]'::jsonb),
    'user', jsonb_build_object(
      'id', auth.uid(),
      'role', public.get_user_role(p_tenant_id)
    ),
    'generated_at', now()
  );

  RETURN v_envelope;
END;
$$;


ALTER FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text") IS 'Monta o Agent Envelope completo (tenant + brand_dna + prompt + rules + user) para envio à Edge Function de IA';



CREATE OR REPLACE FUNCTION "public"."calculate_depth_level"("tenant_id_param" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::integer FROM get_tenant_ancestors(tenant_id_param);
$$;


ALTER FUNCTION "public"."calculate_depth_level"("tenant_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_token_cost"("p_tenant_id" "uuid", "p_format" "text", "p_operation" "text", "p_slide_count" integer DEFAULT 1, "p_ai_model" "text" DEFAULT 'gemini-2.0-flash'::"text") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_config     token_cost_config%ROWTYPE;
  v_base       INTEGER;
  v_slide      NUMERIC;
  v_multiplier NUMERIC;
  v_total      INTEGER;
BEGIN
  -- Tenant-specific config first, fall back to global (tenant_id IS NULL)
  SELECT * INTO v_config
  FROM token_cost_config
  WHERE (tenant_id = p_tenant_id OR tenant_id IS NULL)
    AND format    = p_format
    AND operation = p_operation
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN 1; -- safe fallback
  END IF;
  v_base       := v_config.base_cost;
  v_slide      := COALESCE(v_config.per_slide_cost, 0) * GREATEST(p_slide_count - 1, 0);
  v_multiplier := COALESCE((v_config.ai_model_multiplier ->> p_ai_model)::NUMERIC, 1.0);
  v_total      := CEIL((v_base + v_slide) * v_multiplier);
  RETURN GREATEST(v_total, 1);
END;
$$;


ALTER FUNCTION "public"."calculate_token_cost"("p_tenant_id" "uuid", "p_format" "text", "p_operation" "text", "p_slide_count" integer, "p_ai_model" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_tenant"("accessor_id" "uuid", "target_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    accessor_id = target_id  -- can always see yourself
    OR target_id IN (SELECT get_tenant_descendants(accessor_id))  -- can see descendants
    OR (SELECT is_agency FROM tenants WHERE id = accessor_id) = true 
       AND target_id IN (SELECT get_tenant_descendants(accessor_id));  -- agency can see all descendants
$$;


ALTER FUNCTION "public"."can_access_tenant"("accessor_id" "uuid", "target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_tenant"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() 
        AND (
            tm.tenant_id = p_tenant_id -- Membro do próprio tenant
            OR 
            EXISTS ( -- Ou é agency (depth 1) e o tenant alvo é seu "filho"
                SELECT 1 FROM public.tenants t_sub 
                WHERE t_sub.id = p_tenant_id AND t_sub.parent_tenant_id = tm.tenant_id AND t.depth_level = 1
            )
            OR
            t.depth_level = 0 -- Ou é Master
        )
    );
END;
$$;


ALTER FUNCTION "public"."can_manage_tenant"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_can_generate"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_config           RECORD;
  v_wallet           RECORD;
  v_posts_this_month BIGINT;
  v_tokens_remaining NUMERIC;
  v_post_limit       INTEGER;
BEGIN
  SELECT * INTO v_config FROM tenant_config   WHERE tenant_id = p_tenant_id;
  SELECT * INTO v_wallet FROM credit_wallets  WHERE tenant_id = p_tenant_id;
  SELECT COUNT(*) INTO v_posts_this_month
  FROM posts
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('month', now());
  v_tokens_remaining := COALESCE(v_wallet.prepaid_credits, 0);
  v_post_limit       := COALESCE(v_config.post_limit, 24);
  -- Hard-block checks
  IF COALESCE(v_config.hard_block_enabled, true) THEN
    IF v_tokens_remaining <= 0 THEN
      RETURN jsonb_build_object(
        'allowed',         false,
        'reason',          'tokens_exhausted',
        'message',         COALESCE(v_config.zero_balance_message, 'Saldo de tokens esgotado.'),
        'tokens_remaining', 0,
        'posts_remaining', GREATEST(v_post_limit - v_posts_this_month, 0)
      );
    END IF;
    IF v_posts_this_month >= v_post_limit THEN
      RETURN jsonb_build_object(
        'allowed',          false,
        'reason',           'posts_exhausted',
        'message',          'Limite de posts do mês atingido.',
        'tokens_remaining', v_tokens_remaining,
        'posts_remaining',  0
      );
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'allowed',          true,
    'tokens_remaining', v_tokens_remaining,
    'posts_remaining',  GREATEST(v_post_limit - v_posts_this_month, 0),
    'posts_used',       v_posts_this_month,
    'posts_limit',      v_post_limit,
    'low_balance',      (v_tokens_remaining <= COALESCE(v_config.low_balance_threshold, 50))
  );
END;
$$;


ALTER FUNCTION "public"."check_can_generate"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_role text;
  v_role_hierarchy text[] := ARRAY['sys_admin', 'agency_admin', 'tenant_admin', 'tenant_editor', 'tenant_viewer'];
  v_user_level int;
  v_required_level int;
BEGIN
  SELECT role INTO v_user_role
  FROM public.tenant_members
  WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
    AND status = 'active';

  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;

  v_user_level := array_position(v_role_hierarchy, v_user_role);
  v_required_level := array_position(v_role_hierarchy, p_required_role);

  IF v_user_level IS NULL OR v_required_level IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_user_level <= v_required_level;
END;
$$;


ALTER FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") IS 'Verifica se o usuário tem permissão >= required_role no tenant. sys_admin > agency_admin > tenant_admin > tenant_editor > tenant_viewer';



CREATE OR REPLACE FUNCTION "public"."check_schedule_limit"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_limit INTEGER;
    v_count INTEGER;
    v_month_start DATE;
BEGIN
    -- 1. Obter limite do tenant
    SELECT schedule_post_limit INTO v_limit 
    FROM public.tenant_config 
    WHERE tenant_id = p_tenant_id;
    
    -- Se não houver config, assumimos limite zero ou padrão
    v_limit := COALESCE(v_limit, 0);
    
    -- 2. Obter contagem do mês corrente
    v_month_start := date_trunc('month', now())::DATE;
    
    SELECT scheduled_count INTO v_count 
    FROM public.schedule_usage_log 
    WHERE tenant_id = p_tenant_id AND billing_month = v_month_start;
    
    -- Se não houver log para o mês, a contagem é zero
    v_count := COALESCE(v_count, 0);
    
    -- 3. Retornar se pode agendar (contagem < limite)
    RETURN v_count < v_limit;
END;
$$;


ALTER FUNCTION "public"."check_schedule_limit"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE credit_wallets
  SET
    prepaid_credits = GREATEST(prepaid_credits - p_amount, 0),
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- If no wallet exists yet, create one with reduced credits
  IF NOT FOUND THEN
    INSERT INTO credit_wallets (tenant_id, prepaid_credits, overage_amount, created_at, updated_at)
    VALUES (p_tenant_id, GREATEST(1000 - p_amount, 0), 0, NOW(), NOW());
  END IF;
END;
$$;


ALTER FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.credit_wallets
    SET 
        prepaid_credits = CASE 
            WHEN prepaid_credits >= p_amount THEN prepaid_credits - p_amount 
            ELSE 0 
        END,
        overage_amount = CASE 
            WHEN prepaid_credits < p_amount THEN overage_amount + (p_amount - prepaid_credits)
            ELSE overage_amount
        END,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;
END;
$$;


ALTER FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_tenant_member"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_role" "text" DEFAULT 'client_user'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id
  FROM public.tenant_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

  IF v_member_id IS NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    VALUES (p_tenant_id, p_user_id, p_role, 'active')
    RETURNING id INTO v_member_id;
  END IF;

  RETURN v_member_id;
END;
$$;


ALTER FUNCTION "public"."ensure_tenant_member"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_popups"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE popup_events
  SET status = 'expired'
  WHERE status IN ('pending', 'displayed')
    AND created_at < now() - (ttl_hours || ' hours')::interval;
END;
$$;


ALTER FUNCTION "public"."expire_old_popups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agent_envelope_service"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_envelope jsonb;
  v_brand_dna jsonb;
  v_prompt record;
  v_rules jsonb;
  v_tenant record;
BEGIN
  -- Get tenant info
  SELECT name, slug, plan, settings INTO v_tenant
  FROM public.tenants WHERE id = p_tenant_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  -- Get Brand DNA
  v_brand_dna := public.get_brand_dna(p_tenant_id);

  -- Get active system prompt (content-factory or first active)
  SELECT * INTO v_prompt FROM public.system_prompts
  WHERE tenant_id = p_tenant_id AND is_active = true
  ORDER BY 
    CASE WHEN name ILIKE '%content%factory%' THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  -- Get active compliance rules
  SELECT jsonb_agg(jsonb_build_object(
    'rule_type', rule_type,
    'rule_config', rule_config,
    'severity', severity
  )) INTO v_rules
  FROM public.compliance_rules
  WHERE tenant_id = p_tenant_id AND is_active = true;

  -- Build envelope
  v_envelope := jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', p_tenant_id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'plan', v_tenant.plan
    ),
    'brand_dna', COALESCE(v_brand_dna, '{}'::jsonb),
    'system_prompt', CASE 
      WHEN v_prompt IS NOT NULL THEN jsonb_build_object(
        'id', v_prompt.id,
        'name', v_prompt.name,
        'content', v_prompt.prompt_text,
        'model', v_prompt.model_target,
        'temperature', v_prompt.temperature
      )
      ELSE NULL
    END,
    'compliance_rules', COALESCE(v_rules, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_envelope;
END;
$$;


ALTER FUNCTION "public"."get_agent_envelope_service"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agent_envelope_service"("p_tenant_id" "uuid") IS 'Service-role version of build_agent_envelope. Returns Brand DNA + system prompt + compliance rules for a tenant. Used by content-factory-ai Edge Function.';



CREATE OR REPLACE FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'voice_tone', voice_tone,
    'voice_description', voice_description,
    'personality_traits', personality_traits,
    'forbidden_words', forbidden_words,
    'hashtag_strategy', hashtag_strategy,
    'color_palette', color_palette,
    'typography', typography,
    'target_audience', target_audience,
    'brand_values', brand_values,
    'content_rules', content_rules,
    'sample_posts', sample_posts,
    'language', language
  )
  FROM public.brand_dna
  WHERE tenant_id = p_tenant_id;
$$;


ALTER FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") IS 'Retorna o Brand DNA completo como JSON para injeção no Agent Envelope';



CREATE OR REPLACE FUNCTION "public"."get_social_token"("p_secret_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Token not found or could not be decrypted';
  END IF;
  
  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."get_social_token"("p_secret_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE tree AS (
    SELECT parent_tenant_id AS id FROM tenants WHERE id = child_id AND parent_tenant_id IS NOT NULL
    UNION ALL
    SELECT t.parent_tenant_id AS id FROM tenants t JOIN tree ON t.id = tree.id WHERE t.parent_tenant_id IS NOT NULL
  )
  SELECT id FROM tree;
$$;


ALTER FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") IS 'Returns all ancestor tenant IDs (parent, grandparent, etc.) for a given tenant';



CREATE OR REPLACE FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM tenants WHERE parent_tenant_id = root_id
    UNION ALL
    SELECT t.id FROM tenants t JOIN tree ON t.parent_tenant_id = tree.id
  )
  SELECT id FROM tree;
$$;


ALTER FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") IS 'Returns all descendant tenant IDs (children, grandchildren, etc.) for a given root tenant';



CREATE OR REPLACE FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.tenant_members
  WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") IS 'Retorna a role do usuário autenticado em um tenant específico';



CREATE OR REPLACE FUNCTION "public"."get_user_tenants"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug,
      'plan', t.plan,
      'status', t.status,
      'settings', t.settings,
      'role', tm.role,
      'member_status', tm.status
    ) ORDER BY t.name
  ), '[]'::jsonb)
  FROM public.tenants t
  INNER JOIN public.tenant_members tm ON tm.tenant_id = t.id
  WHERE tm.user_id = auth.uid()
    AND tm.status = 'active'
    AND t.status = 'active';
$$;


ALTER FUNCTION "public"."get_user_tenants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authorized_for_tenant"("target_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_id uuid;
    user_tenant record;
BEGIN
    current_user_id := auth.uid();
    
    -- If no user is logged in, obviously false.
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    -- Get the User's primary tenant membership
    -- (We assume ONE primary membership for simplification, taking the clearest match)
    SELECT t.id, t.depth_level INTO user_tenant
    FROM public.tenant_members tm
    JOIN public.tenants t ON tm.tenant_id = t.id
    WHERE tm.user_id = current_user_id
    LIMIT 1;
    -- Condition 0: The user doesn't belong to ANY tenant
    IF user_tenant IS NULL THEN
        RETURN false;
    END IF;
    -- Condition 1: Direct Ownership (The user is querying their own exact tenant)
    IF user_tenant.id = target_tenant_id THEN
        RETURN true;
    END IF;
    -- Condition 2: Master Access (Depth = 0)
    -- Master can access ALL tenants globally.
    IF user_tenant.depth_level = 0 THEN
        RETURN true;
    END IF;
    -- Condition 3: Agency Access (Depth = 1)
    -- Agency can access any tenant where parent_tenant_id = agency.id
    IF user_tenant.depth_level = 1 THEN
        PERFORM 1 FROM public.tenants 
        WHERE id = target_tenant_id 
          AND parent_tenant_id = user_tenant.id;
          
        IF FOUND THEN
            RETURN true;
        END IF;
    END IF;
    -- Condition 4: Client Access (Depth = 2)
    -- Clients can NEVER access records outside their own exact tenant.
    -- Since we already checked Condition 1 (Direct Ownership), we return false.
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."is_authorized_for_tenant"("target_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_master"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members tm 
        JOIN public.tenants t ON tm.tenant_id = t.id 
        WHERE tm.user_id = auth.uid() AND t.depth_level = 0
    );
END;
$$;


ALTER FUNCTION "public"."is_master"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_observatory_member"("check_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = check_tenant_id
    AND status = 'active'
    AND (settings->>'is_observatory')::boolean = true
  );
$$;


ALTER FUNCTION "public"."is_observatory_member"("check_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_sys_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND role = 'sys_admin'
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_sys_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_sys_admin"() IS 'Retorna true se o usuário autenticado é sys_admin em qualquer tenant';



CREATE OR REPLACE FUNCTION "public"."provision_tenant_member"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_role" "text" DEFAULT 'client_user'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (p_tenant_id, p_user_id, p_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;


ALTER FUNCTION "public"."provision_tenant_member"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_social_token"("p_tenant_id" "uuid", "p_platform" "text", "p_token" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
DECLARE
  v_secret_name TEXT;
  v_secret_id UUID;
BEGIN
  -- Build a unique secret name
  v_secret_name := 'social_token_' || p_platform || '_' || p_tenant_id::TEXT;
  
  -- Delete any existing secret with same name (for token refresh)
  DELETE FROM vault.secrets WHERE name = v_secret_name;
  
  -- Insert the new token into vault
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (
    v_secret_name,
    p_token,
    'Social media access token for ' || p_platform || ' tenant ' || p_tenant_id::TEXT
  )
  RETURNING id INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$$;


ALTER FUNCTION "public"."store_social_token"("p_tenant_id" "uuid", "p_platform" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_depth_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.parent_tenant_id IS NULL THEN
    NEW.depth_level := 0;
  ELSE
    NEW.depth_level := (SELECT calculate_depth_level(NEW.id) + 1);
    -- Simpler: count ancestors of parent + 1
    NEW.depth_level := (SELECT COALESCE(depth_level, 0) + 1 FROM tenants WHERE id = NEW.parent_tenant_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_depth_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_posts_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "category" "text" DEFAULT 'system'::"text",
    "summary" "text",
    "detail" "text",
    "is_autonomous" boolean DEFAULT false,
    "show_toast" boolean DEFAULT false,
    "toast_duration" integer DEFAULT 8000,
    CONSTRAINT "activity_log_category_check" CHECK (("category" = ANY (ARRAY['system'::"text", 'sync'::"text", 'quality_gate'::"text", 'sentiment'::"text", 'ai_generation'::"text", 'feedback'::"text", 'schedule'::"text", 'compliance'::"text"]))),
    CONSTRAINT "activity_log_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_packages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "token_amount" integer DEFAULT 0 NOT NULL,
    "post_amount" integer DEFAULT 0 NOT NULL,
    "price_brl" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "stripe_price_id" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."addon_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addon_purchases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "payment_reference" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."addon_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."addons_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "pricing_type" "text" NOT NULL,
    "price_brl" numeric(10,2),
    "trial_days" integer DEFAULT 7,
    "category" "text",
    "feature_flag" "text",
    "min_plan" "text" DEFAULT 'starter'::"text",
    "requires_addons" "text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "addons_catalog_category_check" CHECK (("category" = ANY (ARRAY['content'::"text", 'analytics'::"text", 'automation'::"text", 'integration'::"text", 'ai_engine'::"text", 'client_facing'::"text"]))),
    CONSTRAINT "addons_catalog_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['monthly'::"text", 'per_use'::"text", 'one_time'::"text", 'included'::"text", 'trial'::"text"])))
);


ALTER TABLE "public"."addons_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_type" "text" DEFAULT 'content_generation'::"text" NOT NULL,
    "model_used" "text" DEFAULT 'claude-sonnet-4-5-20250929'::"text" NOT NULL,
    "system_prompt_id" "uuid",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tools_available" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(10,6) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."ai_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audience_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "location" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "age_groups" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "genders" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "purchase_interests" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "lifestyle_markers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "content_consumption" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sentiment_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dynamic_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audience_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "billing_parent_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "billing_email" "text",
    "billing_type" "text" DEFAULT 'self'::"text" NOT NULL,
    "monthly_base_brl" numeric DEFAULT 0 NOT NULL,
    "markup_pct" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "next_invoice_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_accounts_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['self'::"text", 'parent_pays'::"text", 'grandparent_pays'::"text"])))
);


ALTER TABLE "public"."billing_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_accounts" IS 'Billing cascade: who pays for each tenant. Supports direct, reseller, and hybrid models.';



COMMENT ON COLUMN "public"."billing_accounts"."billing_parent_id" IS 'Who bills this tenant. NULL = Cestari Studio bills directly. Set to white-label agency ID if reseller model.';



COMMENT ON COLUMN "public"."billing_accounts"."billing_type" IS 'self = tenant pays themselves; parent_pays = parent agency pays; grandparent_pays = root agency (Cestari) pays directly';



COMMENT ON COLUMN "public"."billing_accounts"."markup_pct" IS 'Markup percentage the billing parent charges on top of base cost';



CREATE TABLE IF NOT EXISTS "public"."billing_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "contract_url" "text" NOT NULL,
    "version" "text" DEFAULT '1.0.0'::"text",
    "signed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."billing_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_dna" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "voice_tone" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "voice_description" "text",
    "language" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "persona_name" "text",
    "regional_notes" "text",
    "content_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "forbidden_words" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hashtag_strategy" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "color_palette" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sample_posts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "personality_traits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "typography" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "target_audience" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "brand_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "char_limits" "jsonb" DEFAULT '{"reel_titulo": 60, "reel_legenda": 2200, "reel_overlay": 40, "estatico_titulo": 60, "estatico_legenda": 2200, "carrossel_legenda": 2200, "estatico_paragrafo": 280, "carrossel_texto_card": 150, "carrossel_titulo_capa": 60, "carrossel_titulo_card": 50}'::"jsonb" NOT NULL,
    "editorial_pillars" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "audience_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "references_and_benchmarks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "generation_notes" "text" DEFAULT ''::"text" NOT NULL,
    "mandatory_terms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "strict_compliance" boolean DEFAULT true NOT NULL,
    "brand_story" "text",
    "industry" "text",
    "cta_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "tone_modifiers" "text"[] DEFAULT '{}'::"text"[],
    "target_audience_v2" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."brand_dna" OWNER TO "postgres";


COMMENT ON TABLE "public"."brand_dna" IS 'Foundation v5.0: Enhanced identity structure';



COMMENT ON COLUMN "public"."brand_dna"."voice_tone" IS 'Tom de voz completo: primary_tone, secondary_tone, register, vocabulario_chave';



COMMENT ON COLUMN "public"."brand_dna"."personality_traits" IS 'Traits, archetypes, communication_style';



COMMENT ON COLUMN "public"."brand_dna"."typography" IS 'Fonts, hierarchy, social_media_rules';



COMMENT ON COLUMN "public"."brand_dna"."target_audience" IS 'Primary, secondary audiences + platform priority';



COMMENT ON COLUMN "public"."brand_dna"."brand_values" IS 'Core values, manifesto, slogan, competitive_edge';



COMMENT ON COLUMN "public"."brand_dna"."char_limits" IS 'Per-format character limits JSONB: {reel_titulo, reel_legenda, ...}';



COMMENT ON COLUMN "public"."brand_dna"."editorial_pillars" IS 'Array of {name, weight_pct, description, keywords[]}';



COMMENT ON COLUMN "public"."brand_dna"."audience_profile" IS 'Structured audience: {demographics, psychographics, pain_points, goals}';



COMMENT ON COLUMN "public"."brand_dna"."references_and_benchmarks" IS 'Array of {url, description, what_to_learn}';



COMMENT ON COLUMN "public"."brand_dna"."generation_notes" IS 'Free-text notes for AI generation context';



COMMENT ON COLUMN "public"."brand_dna"."mandatory_terms" IS 'Array of terms that must appear in content';



CREATE TABLE IF NOT EXISTS "public"."compliance_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rule_type" "text" NOT NULL,
    "rule_config" "jsonb" NOT NULL,
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "compliance_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['forbidden_word'::"text", 'tone_check'::"text", 'length_limit'::"text", 'brand_consistency'::"text", 'hashtag_rule'::"text", 'emoji_limit'::"text", 'content_requirement'::"text", 'language'::"text", 'structure_validation'::"text"]))),
    CONSTRAINT "compliance_rules_severity_check" CHECK (("severity" = ANY (ARRAY['error'::"text", 'warning'::"text", 'info'::"text"])))
);


ALTER TABLE "public"."compliance_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connected_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "account_name" "text",
    "credentials" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "account_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "connected_by" "uuid",
    CONSTRAINT "connected_accounts_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'linkedin'::"text", 'tiktok'::"text", 'wix'::"text", 'webflow'::"text"]))),
    CONSTRAINT "connected_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."connected_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."connected_accounts"."metadata" IS 'Dados extras: profile_url, site_url, etc.';



CREATE TABLE IF NOT EXISTS "public"."content_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "title" "text",
    "body" "text",
    "media_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "platform" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "compliance_score" integer,
    "compliance_notes" "jsonb",
    "ai_session_id" "uuid",
    "scheduled_for" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hashtags" "text"[] DEFAULT '{}'::"text"[],
    "visual_direction" "jsonb" DEFAULT '{}'::"jsonb",
    "pillar" "text",
    "csv_source_slug" "text",
    "csv_row_id" "text",
    "csv_row_hash" "text",
    "wix_item_id" "text",
    "wix_collection" "text",
    "wix_site_id" "text",
    "wix_last_sync" timestamp with time zone,
    "extra_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "client_feedback" "text",
    "client_comment" "text",
    "client_rating" integer,
    "revision_count" integer DEFAULT 0,
    "ai_provider_used" "text",
    "ai_model" "text",
    "scheduled_date" "date",
    "time_slot" "text",
    "feedback_history" "jsonb" DEFAULT '[]'::"jsonb",
    "app_slug" "text" DEFAULT 'content-factory'::"text",
    CONSTRAINT "content_items_client_feedback_check" CHECK ((("client_feedback" IS NULL) OR ("client_feedback" = ANY (ARRAY['approved'::"text", 'needs_revision'::"text", 'rejected'::"text", 'pending'::"text"])))),
    CONSTRAINT "content_items_client_rating_check" CHECK ((("client_rating" IS NULL) OR (("client_rating" >= 1) AND ("client_rating" <= 5)))),
    CONSTRAINT "content_items_compliance_score_check" CHECK ((("compliance_score" >= 0) AND ("compliance_score" <= 100))),
    CONSTRAINT "content_items_content_type_check" CHECK (("content_type" = ANY (ARRAY['social_post'::"text", 'blog_article'::"text", 'video_script'::"text", 'image_brief'::"text", 'travel_listing'::"text", 'newsletter'::"text", 'course'::"text", 'meditation'::"text", 'general'::"text", 'insight'::"text", 'post_carrossel'::"text", 'post_estatico'::"text", 'reels'::"text", 'stories'::"text", 'blog_post'::"text", 'brief'::"text", 'case_study'::"text", 'landing_page'::"text", 'email_campaign'::"text"]))),
    CONSTRAINT "content_items_platform_check" CHECK ((("platform" IS NULL) OR ("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'linkedin'::"text", 'tiktok'::"text", 'blog'::"text", 'youtube'::"text", 'email'::"text", 'wix'::"text", 'multi'::"text"])))),
    CONSTRAINT "content_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."content_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_items" IS 'DEPRECATED: migrated to posts + post_media. Do not use for new features.';



COMMENT ON COLUMN "public"."content_items"."visual_direction" IS 'Brief visual gerado pela IA (formato, paleta, mood)';



COMMENT ON COLUMN "public"."content_items"."pillar" IS 'Pilar de conteúdo: educacional, case_study, showcase, visionario, etc.';



COMMENT ON COLUMN "public"."content_items"."csv_source_slug" IS 'CSV slug from csv_registry (e.g. trips, blog-posts)';



COMMENT ON COLUMN "public"."content_items"."csv_row_id" IS 'Row ID from the CSV file (id column)';



COMMENT ON COLUMN "public"."content_items"."csv_row_hash" IS 'MD5 hash of the CSV row for drift detection';



COMMENT ON COLUMN "public"."content_items"."wix_item_id" IS 'Wix CMS item _id';



COMMENT ON COLUMN "public"."content_items"."wix_collection" IS 'Wix CMS collection name (e.g. Trips, BlogPosts)';



COMMENT ON COLUMN "public"."content_items"."extra_fields" IS 'JSONB bag for CSV fields that dont map 1:1 to content_items columns';



COMMENT ON COLUMN "public"."content_items"."client_feedback" IS 'Client feedback status from Wix: approved, needs_revision, rejected';



COMMENT ON COLUMN "public"."content_items"."ai_provider_used" IS 'AI provider that generated this content: gemini, claude, apple';



COMMENT ON COLUMN "public"."content_items"."scheduled_date" IS 'Calendar date for scheduled content (YYYY-MM-DD)';



COMMENT ON COLUMN "public"."content_items"."time_slot" IS 'Suggested time slot (e.g. "10:00", "melhor horário")';



COMMENT ON COLUMN "public"."content_items"."feedback_history" IS 'Archived feedback entries: [{date, feedback, status, archivedAt}]';



CREATE TABLE IF NOT EXISTS "public"."credit_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prepaid_credits" numeric DEFAULT 0 NOT NULL,
    "overage_amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."credit_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."csv_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "csv_slug" "text" NOT NULL,
    "csv_category" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "local_path" "text" NOT NULL,
    "wix_collection" "text",
    "wix_site_id" "text",
    "sync_direction" "text" DEFAULT 'local_only'::"text" NOT NULL,
    "sync_enabled" boolean DEFAULT true,
    "sync_interval_s" integer DEFAULT 300,
    "last_sync_at" timestamp with time zone,
    "last_sync_hash" "text",
    "row_count" integer DEFAULT 0,
    "column_schema" "jsonb" DEFAULT '[]'::"jsonb",
    "field_mapping" "jsonb" DEFAULT '{}'::"jsonb",
    "feedback_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "depends_on" "text"[] DEFAULT '{}'::"text"[],
    "triggers_update" "text"[] DEFAULT '{}'::"text"[],
    "auto_generate" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "csv_registry_csv_category_check" CHECK (("csv_category" = ANY (ARRAY['content'::"text", 'feedback'::"text", 'insights'::"text", 'operations'::"text"]))),
    CONSTRAINT "csv_registry_sync_direction_check" CHECK (("sync_direction" = ANY (ARRAY['to_wix'::"text", 'from_wix'::"text", 'bidirectional'::"text", 'local_only'::"text"])))
);


ALTER TABLE "public"."csv_registry" OWNER TO "postgres";


COMMENT ON TABLE "public"."csv_registry" IS 'Master index of all CSV files per tenant — stores metadata, field mappings, sync config, and dependency graph edges';



COMMENT ON COLUMN "public"."csv_registry"."csv_slug" IS 'Kebab-case identifier (e.g. trips, blog-posts). Unique per tenant.';



COMMENT ON COLUMN "public"."csv_registry"."depends_on" IS 'Array of csv_slugs this CSV depends on (dependency graph edges)';



COMMENT ON COLUMN "public"."csv_registry"."triggers_update" IS 'Array of csv_slugs that get updated when this CSV changes';



CREATE TABLE IF NOT EXISTS "public"."csv_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "csv_registry_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "rows_affected" integer DEFAULT 0,
    "rows_created" integer DEFAULT 0,
    "rows_updated" integer DEFAULT 0,
    "rows_failed" integer DEFAULT 0,
    "status" "text" DEFAULT 'success'::"text",
    "error_message" "text",
    "triggered_by" "text" DEFAULT 'auto'::"text",
    "duration_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "csv_sync_log_direction_check" CHECK (("direction" = ANY (ARRAY['to_wix'::"text", 'from_wix'::"text", 'to_csv'::"text", 'from_csv'::"text", 'to_supabase'::"text", 'feedback_received'::"text", 'dependency_cascade'::"text", 'csv_change_detected'::"text"]))),
    CONSTRAINT "csv_sync_log_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'error'::"text"]))),
    CONSTRAINT "csv_sync_log_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['auto'::"text", 'manual'::"text", 'webhook'::"text", 'dependency'::"text", 'watcher'::"text", 'schedule'::"text"])))
);


ALTER TABLE "public"."csv_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."csv_sync_log" IS 'Audit trail of every sync operation between CSV, Supabase, and Wix';



CREATE TABLE IF NOT EXISTS "public"."feedback_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "csv_slug" "text" NOT NULL,
    "csv_row_id" "text" NOT NULL,
    "wix_item_id" "text",
    "feedback_type" "text" NOT NULL,
    "client_comment" "text",
    "client_rating" integer,
    "previous_status" "text",
    "priority" "text" DEFAULT 'normal'::"text",
    "processing_status" "text" DEFAULT 'pending'::"text",
    "ai_session_id" "uuid",
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "content_item_id" "uuid",
    CONSTRAINT "feedback_queue_client_rating_check" CHECK ((("client_rating" IS NULL) OR (("client_rating" >= 1) AND ("client_rating" <= 5)))),
    CONSTRAINT "feedback_queue_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['approved'::"text", 'needs_revision'::"text", 'rejected'::"text", 'comment_only'::"text", 'rating_only'::"text"]))),
    CONSTRAINT "feedback_queue_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "feedback_queue_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ai_revising'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."feedback_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_queue" IS 'Client feedback from Wix awaiting AI processing. Priority: rejected > needs_revision > comment_only > approved > rating_only';



COMMENT ON COLUMN "public"."feedback_queue"."priority" IS 'Auto-derived from feedback_type: rejected=urgent, needs_revision=high, comment_only=normal, approved/rating_only=low';



CREATE TABLE IF NOT EXISTS "public"."marketplace_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_tenant_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "storage_path" "text",
    "preview_url" "text",
    "downloads" integer DEFAULT 0 NOT NULL,
    "rating" double precision,
    "total_ratings" integer DEFAULT 0 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_items_currency_check" CHECK (("currency" = ANY (ARRAY['BRL'::"text", 'GBP'::"text", 'USD'::"text"]))),
    CONSTRAINT "marketplace_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['template'::"text", 'image_pack'::"text", 'video_pack'::"text", 'prompt_pack'::"text"]))),
    CONSTRAINT "marketplace_items_price_cents_check" CHECK (("price_cents" >= 0)),
    CONSTRAINT "marketplace_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketplace_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_tenant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "stripe_payment_id" "text",
    "stripe_checkout_session_id" "text",
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "revenue_share_seller_cents" integer,
    "revenue_share_platform_cents" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "purchased_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_purchases_currency_check" CHECK (("currency" = ANY (ARRAY['BRL'::"text", 'GBP'::"text", 'USD'::"text"]))),
    CONSTRAINT "marketplace_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."marketplace_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "server_name" "text" NOT NULL,
    "server_url" "text" NOT NULL,
    "config_encrypted" "text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "last_health_check" timestamp with time zone,
    "error_message" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcp_connections_server_name_check" CHECK (("server_name" = ANY (ARRAY['wix'::"text", 'stripe'::"text", 'figma'::"text", 'supabase'::"text", 'custom'::"text"]))),
    CONSTRAINT "mcp_connections_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."mcp_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."popup_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "popup_code" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "persistence" "text" DEFAULT 'persistent'::"text",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "has_upsell" boolean DEFAULT false,
    "upsell_type" "text",
    "upsell_product" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "action_taken" "text",
    "displayed_at" timestamp with time zone,
    "acted_at" timestamp with time zone,
    "trigger_data" "jsonb" DEFAULT '{}'::"jsonb",
    "ttl_hours" integer DEFAULT 72,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "popup_events_category_check" CHECK (("category" = ANY (ARRAY['autonomous_content'::"text", 'insights_analytics'::"text", 'maintenance'::"text", 'commercial'::"text", 'system_onboarding'::"text", 'social_proof'::"text"]))),
    CONSTRAINT "popup_events_persistence_check" CHECK (("persistence" = ANY (ARRAY['toast'::"text", 'persistent'::"text", 'modal'::"text", 'banner'::"text"]))),
    CONSTRAINT "popup_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"]))),
    CONSTRAINT "popup_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'displayed'::"text", 'action_taken'::"text", 'dismissed'::"text", 'expired'::"text", 'converted'::"text"]))),
    CONSTRAINT "popup_events_upsell_type_check" CHECK (("upsell_type" = ANY (ARRAY['addon'::"text", 'upgrade'::"text", 'service'::"text", 'trial'::"text", 'package'::"text", NULL::"text"])))
);


ALTER TABLE "public"."popup_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."observatory_popup_analytics" WITH ("security_invoker"='true') AS
 SELECT "popup_code",
    "category",
    "has_upsell",
    "upsell_product",
    "count"(*) AS "total_emitted",
    "count"(*) FILTER (WHERE ("status" = 'displayed'::"text")) AS "total_displayed",
    "count"(*) FILTER (WHERE ("status" = 'action_taken'::"text")) AS "total_actioned",
    "count"(*) FILTER (WHERE ("status" = 'dismissed'::"text")) AS "total_dismissed",
    "count"(*) FILTER (WHERE ("status" = 'expired'::"text")) AS "total_expired",
    "count"(*) FILTER (WHERE ("status" = 'converted'::"text")) AS "total_converted",
    "round"(((("count"(*) FILTER (WHERE ("status" = 'action_taken'::"text")))::numeric / (NULLIF("count"(*) FILTER (WHERE ("status" = ANY (ARRAY['displayed'::"text", 'action_taken'::"text", 'dismissed'::"text"]))), 0))::numeric) * (100)::numeric), 1) AS "action_rate",
    "round"(((("count"(*) FILTER (WHERE ("status" = 'converted'::"text")))::numeric / (NULLIF("count"(*) FILTER (WHERE (("has_upsell" = true) AND ("status" = ANY (ARRAY['displayed'::"text", 'action_taken'::"text", 'dismissed'::"text", 'converted'::"text"])))), 0))::numeric) * (100)::numeric), 1) AS "conversion_rate",
    "round"(("avg"(EXTRACT(epoch FROM ("acted_at" - "displayed_at"))) / (60)::numeric), 1) AS "avg_minutes_to_action"
   FROM "public"."popup_events" "pe"
  GROUP BY "popup_code", "category", "has_upsell", "upsell_product";


ALTER VIEW "public"."observatory_popup_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "trial_ends_at" timestamp with time zone,
    "activated_at" timestamp with time zone DEFAULT "now"(),
    "cancelled_at" timestamp with time zone,
    "usage_count" integer DEFAULT 0,
    CONSTRAINT "tenant_addons_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."tenant_addons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."observatory_popup_revenue" WITH ("security_invoker"='true') AS
 SELECT "ac"."name" AS "addon_name",
    "ac"."slug" AS "addon_slug",
    "ac"."price_brl",
    "ac"."pricing_type",
    "count"(DISTINCT "ta"."id") AS "total_active_subscriptions",
    "count"(DISTINCT "pe"."id") FILTER (WHERE ("pe"."status" = 'converted'::"text")) AS "conversions_from_popups",
        CASE "ac"."pricing_type"
            WHEN 'monthly'::"text" THEN (("count"(DISTINCT "ta"."id"))::numeric * "ac"."price_brl")
            ELSE (0)::numeric
        END AS "estimated_mrr_brl"
   FROM (("public"."addons_catalog" "ac"
     LEFT JOIN "public"."tenant_addons" "ta" ON ((("ta"."addon_id" = "ac"."id") AND ("ta"."status" = ANY (ARRAY['active'::"text", 'trial'::"text"])))))
     LEFT JOIN "public"."popup_events" "pe" ON ((("pe"."upsell_product" = "ac"."slug") AND ("pe"."status" = 'converted'::"text"))))
  WHERE ("ac"."is_active" = true)
  GROUP BY "ac"."id", "ac"."name", "ac"."slug", "ac"."price_brl", "ac"."pricing_type"
  ORDER BY
        CASE "ac"."pricing_type"
            WHEN 'monthly'::"text" THEN (("count"(DISTINCT "ta"."id"))::numeric * "ac"."price_brl")
            ELSE (0)::numeric
        END DESC;


ALTER VIEW "public"."observatory_popup_revenue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    "type" "public"."media_type" DEFAULT 'image'::"public"."media_type" NOT NULL,
    "wix_media_id" "text",
    "wix_media_url" "text",
    "wix_folder_id" "text",
    "file_name" "text",
    "file_size" integer,
    "mime_type" "text",
    "status" "public"."media_status" DEFAULT 'pending'::"public"."media_status" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "format" "public"."post_format" DEFAULT 'feed'::"public"."post_format" NOT NULL,
    "status" "public"."post_status" DEFAULT 'draft'::"public"."post_status" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_date" timestamp with time zone,
    "hashtags" "text",
    "cta" "text",
    "card_data" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "media_slots" integer DEFAULT 1 NOT NULL,
    "ai_instructions" "text",
    "ai_processing" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategy" "text" DEFAULT 'global'::"text" NOT NULL,
    "tenant_id" "uuid",
    "tier" "text",
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "markup_pct" numeric(5,2) DEFAULT 30.00 NOT NULL,
    "flat_fee_per_1k_tokens" numeric(12,6) DEFAULT 0,
    "label" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publish_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "publish_queue_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."publish_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publish_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "container_id" "text",
    "external_post_id" "text",
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "publish_queue_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "publish_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'container_created'::"text", 'published'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."publish_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "content_item_id" "uuid" NOT NULL,
    "attempt" integer DEFAULT 1 NOT NULL,
    "brand_voice" numeric(3,1),
    "char_compliance" numeric(3,1),
    "editorial_coherence" numeric(3,1),
    "engagement_potential" numeric(3,1),
    "format_compliance" numeric(3,1),
    "originality" numeric(3,1),
    "weighted_total" numeric(4,2),
    "passed" boolean NOT NULL,
    "issues" "text"[],
    "improvement_instructions" "text",
    "model_used" "text" DEFAULT 'claude-sonnet'::"text",
    "tokens_used" integer,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quality_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revision_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_item_id" "uuid",
    "tenant_id" "uuid",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "revision_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."revision_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "platform" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text",
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "published_at" timestamp with time zone,
    "external_post_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "schedule_slots_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'instagram_stories'::"text", 'instagram_reels'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "schedule_slots_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'published'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."schedule_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "billing_month" "date" NOT NULL,
    "scheduled_count" integer DEFAULT 0,
    "published_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0
);


ALTER TABLE "public"."schedule_usage_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sentiment_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sentiment_score" integer,
    "trend" "text",
    "approval_rate_first_pass" numeric(5,2),
    "dominant_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "positive_signals" "text"[],
    "risk_signals" "text"[],
    "prompt_adjustment_suggestions" "text"[],
    "posts_analyzed" integer,
    "posts_with_feedback" integer,
    "period_start" "date",
    "period_end" "date",
    "model_used" "text",
    "tokens_used" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sentiment_analysis_sentiment_score_check" CHECK ((("sentiment_score" >= 0) AND ("sentiment_score" <= 100))),
    CONSTRAINT "sentiment_analysis_trend_check" CHECK (("trend" = ANY (ARRAY['improving'::"text", 'stable'::"text", 'declining'::"text"])))
);


ALTER TABLE "public"."sentiment_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "platform_user_id" "text" NOT NULL,
    "platform_username" "text",
    "platform_profile_pic" "text",
    "token_expires_at" timestamp with time zone,
    "token_type" "text" DEFAULT 'long_lived'::"text",
    "scopes" "text"[],
    "ig_account_id" "text",
    "fb_page_id" "text",
    "wa_phone_number_id" "text",
    "wa_business_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "connected_by" "uuid",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "access_token_encrypted_id" "uuid",
    CONSTRAINT "social_connections_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "social_connections_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."social_connections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."social_connections"."access_token_encrypted_id" IS 'UUID reference to vault.secrets where the encrypted access token is stored';



CREATE TABLE IF NOT EXISTS "public"."stripe_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "plan" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "content_type" "text",
    "model_target" "text" DEFAULT 'claude'::"text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "temperature" numeric(3,2) DEFAULT 0.7,
    "description" "text",
    CONSTRAINT "system_prompts_content_type_check" CHECK ((("content_type" IS NULL) OR ("content_type" = ANY (ARRAY['social_post'::"text", 'blog_article'::"text", 'video_script'::"text", 'image_brief'::"text", 'general'::"text", 'compliance_review'::"text", 'newsletter'::"text", 'travel_listing'::"text"])))),
    CONSTRAINT "system_prompts_model_target_check" CHECK (("model_target" = ANY (ARRAY['claude'::"text", 'gemini'::"text", 'watsonx'::"text"])))
);


ALTER TABLE "public"."system_prompts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."system_prompts"."temperature" IS 'Temperatura do modelo (0.0-1.0)';



CREATE TABLE IF NOT EXISTS "public"."tenant_config" (
    "tenant_id" "uuid" NOT NULL,
    "token_balance" integer DEFAULT 5000 NOT NULL,
    "post_limit" integer DEFAULT 12 NOT NULL,
    "formats" "jsonb" DEFAULT '["carousel", "static", "reels", "stories"]'::"jsonb" NOT NULL,
    "ai_model" "text" DEFAULT 'gpt-4o-mini'::"text" NOT NULL,
    "billing_start" "date",
    "billing_end" "date",
    "contact_name" "text" DEFAULT ''::"text",
    "contact_email" "text" DEFAULT ''::"text",
    "contact_phone" "text" DEFAULT ''::"text",
    "char_limit_title" integer DEFAULT 60 NOT NULL,
    "char_limit_body" integer DEFAULT 300 NOT NULL,
    "char_limit_caption" integer DEFAULT 150 NOT NULL,
    "char_limit_cta" integer DEFAULT 40 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "post_language" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "hard_block_enabled" boolean DEFAULT true,
    "overage_allowed" boolean DEFAULT false,
    "low_balance_threshold" integer DEFAULT 50,
    "zero_balance_message" "text" DEFAULT 'Seu saldo de tokens foi esgotado. Adquira um pacote adicional para continuar gerando conteúdo.'::"text",
    "schedule_enabled" boolean DEFAULT false,
    "schedule_tier" "text" DEFAULT 'starter'::"text",
    "schedule_post_limit" integer DEFAULT 12,
    "schedule_billing_start" "date",
    "schedule_price_cents" integer DEFAULT 29000,
    "onboarding_completed" boolean DEFAULT false,
    "contract_signed" boolean DEFAULT false,
    CONSTRAINT "tenant_config_schedule_tier_check" CHECK (("schedule_tier" = ANY (ARRAY['starter'::"text", 'growth'::"text", 'scale'::"text", 'enterprise'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."tenant_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_config" IS 'Per-tenant configuration for tokens, posts, AI model, billing, and contact info';



CREATE TABLE IF NOT EXISTS "public"."tenant_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_members_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'agency_operator'::"text", 'client_user'::"text", 'sys_admin'::"text", 'agency_admin'::"text", 'tenant_admin'::"text", 'tenant_editor'::"text", 'tenant_viewer'::"text"]))),
    CONSTRAINT "tenant_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."tenant_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "owner_id" "uuid",
    "plan" "text" DEFAULT 'starter'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wix_site_id" "text",
    "parent_tenant_id" "uuid",
    "is_agency" boolean DEFAULT false NOT NULL,
    "whitelabel_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "billing_model" "text" DEFAULT 'direct'::"text" NOT NULL,
    "depth_level" integer DEFAULT 0 NOT NULL,
    "wix_member_id" "text",
    "contact_email" "text",
    "wix_folder_id" "text",
    CONSTRAINT "tenants_billing_model_check" CHECK (("billing_model" = ANY (ARRAY['direct'::"text", 'reseller'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "tenants_plan_check" CHECK (("plan" = ANY (ARRAY['starter'::"text", 'professional'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "tenants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenants"."is_agency" IS 'Whether this tenant can have sub-tenants (white-label agency)';



COMMENT ON COLUMN "public"."tenants"."whitelabel_config" IS 'White-label config: {remove_parent_branding, custom_logo_url, custom_domain, custom_colors, platform_name}';



COMMENT ON COLUMN "public"."tenants"."billing_model" IS 'direct = parent bills this tenant; reseller = this tenant bills its own children; hybrid = parent can bill both this tenant AND its children';



COMMENT ON COLUMN "public"."tenants"."depth_level" IS 'Hierarchy depth: 0 = root, 1 = direct child, 2 = grandchild, etc.';



CREATE TABLE IF NOT EXISTS "public"."token_cost_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "format" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "base_cost" integer NOT NULL,
    "per_slide_cost" numeric DEFAULT 0,
    "ai_model_multiplier" "jsonb" DEFAULT '{"gemini-2.5-pro": 3.5, "gemini-2.0-flash": 1.0}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "token_cost_config_format_check" CHECK (("format" = ANY (ARRAY['feed'::"text", 'carrossel'::"text", 'stories'::"text", 'reels'::"text"]))),
    CONSTRAINT "token_cost_config_operation_check" CHECK (("operation" = ANY (ARRAY['generate'::"text", 'revise'::"text", 'format'::"text", 'regenerate'::"text"])))
);


ALTER TABLE "public"."token_cost_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."token_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "ai_session_id" "uuid",
    "provider" "text" DEFAULT 'local'::"text" NOT NULL,
    "model" "text" DEFAULT 'genOS-local-v1'::"text" NOT NULL,
    "session_type" "text" DEFAULT 'content_generation'::"text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer GENERATED ALWAYS AS (("input_tokens" + "output_tokens")) STORED,
    "agency_cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "client_cost_usd" numeric(12,6) DEFAULT 0 NOT NULL,
    "margin_usd" numeric(12,6) GENERATED ALWAYS AS (("client_cost_usd" - "agency_cost_usd")) STORED,
    "pricing_strategy" "text" DEFAULT 'global'::"text" NOT NULL,
    "pricing_config_id" "uuid",
    "content_item_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."token_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "app_slug" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "cost" numeric NOT NULL,
    "is_overage" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "format" "text",
    "slide_count" integer DEFAULT 1,
    "ai_model" "text",
    "actual_api_tokens" integer,
    "genos_tokens_debited" integer,
    "model_name" "text" DEFAULT 'gemini-2.0-flash'::"text",
    "tokens_input" integer DEFAULT 0,
    "tokens_output" integer DEFAULT 0
);


ALTER TABLE "public"."usage_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_alerts" WITH ("security_invoker"='true') AS
 SELECT 'revision_backlog'::"text" AS "alert_type",
    "ci"."tenant_id",
    "t"."name" AS "tenant_name",
    "count"(*) AS "alert_value",
    'Backlog de revisoes acima do limite'::"text" AS "alert_message",
    'warning'::"text" AS "severity",
    "now"() AS "checked_at"
   FROM ("public"."content_items" "ci"
     JOIN "public"."tenants" "t" ON (("t"."id" = "ci"."tenant_id")))
  WHERE ("ci"."status" = ANY (ARRAY['review'::"text", 'pending_review'::"text"]))
  GROUP BY "ci"."tenant_id", "t"."name"
 HAVING ("count"(*) > 5)
UNION ALL
 SELECT 'negative_feedback'::"text" AS "alert_type",
    "fq"."tenant_id",
    "t"."name" AS "tenant_name",
    "round"(((("count"(*) FILTER (WHERE ("fq"."feedback_type" = 'negative'::"text")))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 1) AS "alert_value",
    'Taxa de feedback negativo acima de 30%'::"text" AS "alert_message",
    'error'::"text" AS "severity",
    "now"() AS "checked_at"
   FROM ("public"."feedback_queue" "fq"
     JOIN "public"."tenants" "t" ON (("t"."id" = "fq"."tenant_id")))
  WHERE ("fq"."created_at" >= ("now"() - '30 days'::interval))
  GROUP BY "fq"."tenant_id", "t"."name"
 HAVING ((("count"(*) FILTER (WHERE ("fq"."feedback_type" = 'negative'::"text")))::numeric / (NULLIF("count"(*), 0))::numeric) > 0.30)
UNION ALL
 SELECT 'low_quality'::"text" AS "alert_type",
    "ci"."tenant_id",
    "t"."name" AS "tenant_name",
    "round"("avg"("ci"."compliance_score"), 1) AS "alert_value",
    'Score de compliance medio abaixo de 50'::"text" AS "alert_message",
    'warning'::"text" AS "severity",
    "now"() AS "checked_at"
   FROM ("public"."content_items" "ci"
     JOIN "public"."tenants" "t" ON (("t"."id" = "ci"."tenant_id")))
  WHERE (("ci"."compliance_score" IS NOT NULL) AND ("ci"."created_at" >= ("now"() - '30 days'::interval)))
  GROUP BY "ci"."tenant_id", "t"."name"
 HAVING ("avg"("ci"."compliance_score") < (50)::numeric)
UNION ALL
 SELECT 'inactivity'::"text" AS "alert_type",
    "t"."id" AS "tenant_id",
    "t"."name" AS "tenant_name",
    EXTRACT(day FROM ("now"() - "max"("ci"."updated_at"))) AS "alert_value",
    'Sem atividade ha mais de 7 dias'::"text" AS "alert_message",
    'info'::"text" AS "severity",
    "now"() AS "checked_at"
   FROM ("public"."tenants" "t"
     LEFT JOIN "public"."content_items" "ci" ON (("ci"."tenant_id" = "t"."id")))
  WHERE (("t"."status" = 'active'::"text") AND (COALESCE((("t"."settings" ->> 'is_observatory'::"text"))::boolean, false) = false))
  GROUP BY "t"."id", "t"."name"
 HAVING (("max"("ci"."updated_at") IS NULL) OR ("max"("ci"."updated_at") < ("now"() - '7 days'::interval)));


ALTER VIEW "public"."v_observatory_alerts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_daily_usage" WITH ("security_invoker"='true') AS
 SELECT "date"("tu"."created_at") AS "usage_date",
    "tu"."tenant_id",
    "t"."name" AS "tenant_name",
    "tu"."provider",
    "tu"."model",
    "tu"."session_type",
    "count"(*) AS "request_count",
    "sum"("tu"."total_tokens") AS "tokens",
    ("sum"("tu"."agency_cost_usd"))::numeric(12,6) AS "agency_cost",
    ("sum"("tu"."client_cost_usd"))::numeric(12,6) AS "client_cost",
    ("sum"("tu"."margin_usd"))::numeric(12,6) AS "margin"
   FROM ("public"."token_usage" "tu"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tu"."tenant_id")))
  GROUP BY ("date"("tu"."created_at")), "tu"."tenant_id", "t"."name", "tu"."provider", "tu"."model", "tu"."session_type";


ALTER VIEW "public"."v_observatory_daily_usage" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_model_breakdown" WITH ("security_invoker"='true') AS
 SELECT "provider",
    "model",
    "count"(*) AS "total_requests",
    "count"(DISTINCT "tenant_id") AS "tenants_using",
    "sum"("input_tokens") AS "total_input_tokens",
    "sum"("output_tokens") AS "total_output_tokens",
    "sum"("total_tokens") AS "total_tokens",
    ("sum"("agency_cost_usd"))::numeric(12,4) AS "total_agency_cost",
    ("sum"("client_cost_usd"))::numeric(12,4) AS "total_client_cost",
    ("sum"("margin_usd"))::numeric(12,4) AS "total_margin",
    ("avg"("total_tokens"))::integer AS "avg_tokens_per_request",
        CASE
            WHEN ("sum"("total_tokens") > 0) THEN "round"((("sum"("agency_cost_usd") / ("sum"("total_tokens"))::numeric) * (1000)::numeric), 6)
            ELSE (0)::numeric
        END AS "agency_cost_per_1k_tokens"
   FROM "public"."token_usage" "tu"
  GROUP BY "provider", "model";


ALTER VIEW "public"."v_observatory_model_breakdown" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_profitability" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "tenant_id",
    "t"."name" AS "tenant_name",
    "t"."slug" AS "tenant_slug",
    "t"."plan" AS "tenant_plan",
    "t"."status" AS "tenant_status",
    COALESCE("token_agg"."total_requests", (0)::bigint) AS "ai_requests",
    COALESCE("token_agg"."total_tokens", (0)::bigint) AS "total_tokens",
    (COALESCE("token_agg"."agency_cost", (0)::numeric))::numeric(12,4) AS "agency_cost",
    (COALESCE("token_agg"."client_cost", (0)::numeric))::numeric(12,4) AS "client_cost",
    (COALESCE("token_agg"."margin", (0)::numeric))::numeric(12,4) AS "margin",
        CASE
            WHEN (COALESCE("token_agg"."client_cost", (0)::numeric) > (0)::numeric) THEN "round"((("token_agg"."margin" / "token_agg"."client_cost") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margin_pct",
    COALESCE("content_agg"."total_content", (0)::bigint) AS "total_content",
    COALESCE("content_agg"."published_content", (0)::bigint) AS "published_content",
    (COALESCE("content_agg"."avg_compliance", (0)::numeric))::numeric(5,1) AS "avg_compliance_score",
        CASE
            WHEN (COALESCE("content_agg"."total_content", (0)::bigint) > 0) THEN "round"((COALESCE("token_agg"."agency_cost", (0)::numeric) / ("content_agg"."total_content")::numeric), 4)
            ELSE (0)::numeric
        END AS "cost_per_content_item"
   FROM (("public"."tenants" "t"
     LEFT JOIN ( SELECT "token_usage"."tenant_id",
            "count"(*) AS "total_requests",
            "sum"("token_usage"."total_tokens") AS "total_tokens",
            "sum"("token_usage"."agency_cost_usd") AS "agency_cost",
            "sum"("token_usage"."client_cost_usd") AS "client_cost",
            "sum"("token_usage"."margin_usd") AS "margin"
           FROM "public"."token_usage"
          GROUP BY "token_usage"."tenant_id") "token_agg" ON (("token_agg"."tenant_id" = "t"."id")))
     LEFT JOIN ( SELECT "content_items"."tenant_id",
            "count"(*) AS "total_content",
            "count"(*) FILTER (WHERE ("content_items"."status" = 'published'::"text")) AS "published_content",
            "avg"("content_items"."compliance_score") AS "avg_compliance"
           FROM "public"."content_items"
          GROUP BY "content_items"."tenant_id") "content_agg" ON (("content_agg"."tenant_id" = "t"."id")))
  WHERE (("t"."status" = 'active'::"text") AND (COALESCE((("t"."settings" ->> 'is_observatory'::"text"))::boolean, false) = false));


ALTER VIEW "public"."v_observatory_profitability" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_tenant_costs" WITH ("security_invoker"='true') AS
 SELECT "tu"."tenant_id",
    "t"."name" AS "tenant_name",
    "t"."slug" AS "tenant_slug",
    "date_trunc"('month'::"text", "tu"."created_at") AS "month",
    "tu"."provider",
    "count"(*) AS "request_count",
    "sum"("tu"."total_tokens") AS "tokens",
    ("sum"("tu"."agency_cost_usd"))::numeric(12,4) AS "agency_cost",
    ("sum"("tu"."client_cost_usd"))::numeric(12,4) AS "client_cost",
    ("sum"("tu"."margin_usd"))::numeric(12,4) AS "margin"
   FROM ("public"."token_usage" "tu"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tu"."tenant_id")))
  GROUP BY "tu"."tenant_id", "t"."name", "t"."slug", ("date_trunc"('month'::"text", "tu"."created_at")), "tu"."provider";


ALTER VIEW "public"."v_observatory_tenant_costs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_observatory_token_summary" WITH ("security_invoker"='true') AS
 SELECT "tu"."tenant_id",
    "t"."name" AS "tenant_name",
    "t"."slug" AS "tenant_slug",
    "t"."plan" AS "tenant_plan",
    "count"(*) AS "total_requests",
    "sum"("tu"."input_tokens") AS "total_input_tokens",
    "sum"("tu"."output_tokens") AS "total_output_tokens",
    "sum"("tu"."total_tokens") AS "total_tokens",
    ("sum"("tu"."agency_cost_usd"))::numeric(12,4) AS "total_agency_cost",
    ("sum"("tu"."client_cost_usd"))::numeric(12,4) AS "total_client_cost",
    ("sum"("tu"."margin_usd"))::numeric(12,4) AS "total_margin",
        CASE
            WHEN ("sum"("tu"."client_cost_usd") > (0)::numeric) THEN "round"((("sum"("tu"."margin_usd") / "sum"("tu"."client_cost_usd")) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "margin_pct",
    "min"("tu"."created_at") AS "first_usage",
    "max"("tu"."created_at") AS "last_usage"
   FROM ("public"."token_usage" "tu"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tu"."tenant_id")))
  GROUP BY "tu"."tenant_id", "t"."name", "t"."slug", "t"."plan";


ALTER VIEW "public"."v_observatory_token_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_user_tenant_roles" WITH ("security_invoker"='true') AS
 SELECT "tm"."user_id",
    "tm"."tenant_id",
    "tm"."role",
    "u"."email"
   FROM ("public"."tenant_members" "tm"
     JOIN "auth"."users" "u" ON (("u"."id" = "tm"."user_id")));


ALTER VIEW "public"."v_user_tenant_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_approval_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "approver_id" "uuid",
    "event_type" "text" DEFAULT 'approval_requested'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "message_sid" "text",
    "response_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_approval_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_approvers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "role" "text" DEFAULT 'approver'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wa_approvers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."write_retry_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "csv_slug" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "target" "text" NOT NULL,
    "row_data" "jsonb" NOT NULL,
    "error_msg" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 5,
    "next_retry" timestamp with time zone DEFAULT ("now"() + '00:01:00'::interval),
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "write_retry_queue_operation_check" CHECK (("operation" = ANY (ARRAY['insert'::"text", 'update'::"text", 'delete'::"text"]))),
    CONSTRAINT "write_retry_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'exhausted'::"text"]))),
    CONSTRAINT "write_retry_queue_target_check" CHECK (("target" = ANY (ARRAY['csv'::"text", 'supabase'::"text", 'wix'::"text"])))
);


ALTER TABLE "public"."write_retry_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."write_retry_queue" IS 'Failed dual-write operations awaiting retry with exponential backoff (1, 2, 4, 8, 16 min)';



COMMENT ON COLUMN "public"."write_retry_queue"."target" IS 'Which write target failed: csv (filesystem), supabase (cloud DB), wix (CMS)';



COMMENT ON COLUMN "public"."write_retry_queue"."next_retry" IS 'Exponential backoff: attempt N waits 2^(N-1) minutes';



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_packages"
    ADD CONSTRAINT "addon_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addon_purchases"
    ADD CONSTRAINT "addon_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addons_catalog"
    ADD CONSTRAINT "addons_catalog_feature_flag_key" UNIQUE ("feature_flag");



ALTER TABLE ONLY "public"."addons_catalog"
    ADD CONSTRAINT "addons_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."addons_catalog"
    ADD CONSTRAINT "addons_catalog_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."audience_analytics"
    ADD CONSTRAINT "audience_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."billing_contracts"
    ADD CONSTRAINT "billing_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."compliance_rules"
    ADD CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."csv_registry"
    ADD CONSTRAINT "csv_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."csv_registry"
    ADD CONSTRAINT "csv_registry_tenant_id_csv_slug_key" UNIQUE ("tenant_id", "csv_slug");



ALTER TABLE ONLY "public"."csv_sync_log"
    ADD CONSTRAINT "csv_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_queue"
    ADD CONSTRAINT "feedback_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_items"
    ADD CONSTRAINT "marketplace_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_purchases"
    ADD CONSTRAINT "marketplace_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_connections"
    ADD CONSTRAINT "mcp_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."popup_events"
    ADD CONSTRAINT "popup_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_config"
    ADD CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_config"
    ADD CONSTRAINT "pricing_config_strategy_tenant_id_tier_provider_model_key" UNIQUE NULLS NOT DISTINCT ("strategy", "tenant_id", "tier", "provider", "model");



ALTER TABLE ONLY "public"."publish_log"
    ADD CONSTRAINT "publish_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publish_queue"
    ADD CONSTRAINT "publish_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_scores"
    ADD CONSTRAINT "quality_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revision_requests"
    ADD CONSTRAINT "revision_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_post_id_platform_key" UNIQUE ("post_id", "platform");



ALTER TABLE ONLY "public"."schedule_usage_log"
    ADD CONSTRAINT "schedule_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_usage_log"
    ADD CONSTRAINT "schedule_usage_log_tenant_id_billing_month_key" UNIQUE ("tenant_id", "billing_month");



ALTER TABLE ONLY "public"."sentiment_analysis"
    ADD CONSTRAINT "sentiment_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_tenant_id_platform_platform_user_id_key" UNIQUE ("tenant_id", "platform", "platform_user_id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_app_id_key" UNIQUE ("tenant_id", "app_id");



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_tenant_id_addon_id_key" UNIQUE ("tenant_id", "addon_id");



ALTER TABLE ONLY "public"."tenant_config"
    ADD CONSTRAINT "tenant_config_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_user_unique" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_wix_member_id_key" UNIQUE ("wix_member_id");



ALTER TABLE ONLY "public"."token_cost_config"
    ADD CONSTRAINT "token_cost_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_cost_config"
    ADD CONSTRAINT "token_cost_config_tenant_id_format_operation_key" UNIQUE ("tenant_id", "format", "operation");



ALTER TABLE ONLY "public"."token_usage"
    ADD CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "unique_post_media_position" UNIQUE ("post_id", "position");



ALTER TABLE ONLY "public"."audience_analytics"
    ADD CONSTRAINT "unique_tenant_audience" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_approval_events"
    ADD CONSTRAINT "wa_approval_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_approvers"
    ADD CONSTRAINT "wa_approvers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_retry_queue"
    ADD CONSTRAINT "write_retry_queue_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_category" ON "public"."activity_log" USING "btree" ("category");



CREATE INDEX "idx_activity_log_feed" ON "public"."activity_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_tenant" ON "public"."activity_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_tenant_created" ON "public"."activity_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_user" ON "public"."activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_ai_sessions_prompt" ON "public"."ai_sessions" USING "btree" ("system_prompt_id");



CREATE INDEX "idx_ai_sessions_tenant" ON "public"."ai_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_ai_sessions_tenant_status" ON "public"."ai_sessions" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_ai_sessions_user" ON "public"."ai_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_brand_dna_tenant" ON "public"."brand_dna" USING "btree" ("tenant_id");



CREATE INDEX "idx_compliance_rules_tenant" ON "public"."compliance_rules" USING "btree" ("tenant_id");



CREATE INDEX "idx_compliance_rules_tenant_active" ON "public"."compliance_rules" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_connected_accounts_tenant" ON "public"."connected_accounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_content_items_app" ON "public"."content_items" USING "btree" ("app_slug");



CREATE INDEX "idx_content_items_approved_by" ON "public"."content_items" USING "btree" ("approved_by");



CREATE INDEX "idx_content_items_created_by" ON "public"."content_items" USING "btree" ("created_by");



CREATE INDEX "idx_content_items_csv" ON "public"."content_items" USING "btree" ("tenant_id", "csv_source_slug", "csv_row_id");



CREATE INDEX "idx_content_items_feedback_history" ON "public"."content_items" USING "gin" ("feedback_history");



CREATE INDEX "idx_content_items_hash" ON "public"."content_items" USING "btree" ("csv_row_hash");



CREATE INDEX "idx_content_items_scheduled_date" ON "public"."content_items" USING "btree" ("tenant_id", "scheduled_date") WHERE ("scheduled_date" IS NOT NULL);



CREATE INDEX "idx_content_items_session" ON "public"."content_items" USING "btree" ("ai_session_id");



CREATE INDEX "idx_content_items_status" ON "public"."content_items" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_content_items_tenant" ON "public"."content_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_content_items_tenant_pillar" ON "public"."content_items" USING "btree" ("tenant_id", "pillar");



CREATE INDEX "idx_content_items_tenant_status" ON "public"."content_items" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_content_items_wix" ON "public"."content_items" USING "btree" ("wix_item_id");



CREATE INDEX "idx_csv_registry_slug" ON "public"."csv_registry" USING "btree" ("tenant_id", "csv_slug");



CREATE INDEX "idx_csv_registry_tenant" ON "public"."csv_registry" USING "btree" ("tenant_id");



CREATE INDEX "idx_csv_sync_log_registry" ON "public"."csv_sync_log" USING "btree" ("csv_registry_id", "created_at" DESC);



CREATE INDEX "idx_csv_sync_log_tenant" ON "public"."csv_sync_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_feedback_queue_csv" ON "public"."feedback_queue" USING "btree" ("tenant_id", "csv_slug", "csv_row_id");



CREATE INDEX "idx_feedback_queue_pending" ON "public"."feedback_queue" USING "btree" ("processing_status", "priority", "created_at") WHERE ("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ai_revising'::"text"]));



CREATE INDEX "idx_feedback_queue_tenant" ON "public"."feedback_queue" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_marketplace_items_seller" ON "public"."marketplace_items" USING "btree" ("seller_tenant_id");



CREATE INDEX "idx_marketplace_items_status" ON "public"."marketplace_items" USING "btree" ("status");



CREATE INDEX "idx_marketplace_purchases_buyer" ON "public"."marketplace_purchases" USING "btree" ("buyer_tenant_id");



CREATE INDEX "idx_marketplace_purchases_item" ON "public"."marketplace_purchases" USING "btree" ("item_id");



CREATE INDEX "idx_mcp_connections_created_by" ON "public"."mcp_connections" USING "btree" ("created_by");



CREATE INDEX "idx_mcp_connections_tenant" ON "public"."mcp_connections" USING "btree" ("tenant_id");



CREATE INDEX "idx_popup_code" ON "public"."popup_events" USING "btree" ("popup_code", "created_at" DESC);



CREATE INDEX "idx_popup_pending" ON "public"."popup_events" USING "btree" ("tenant_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_popup_upsell" ON "public"."popup_events" USING "btree" ("has_upsell", "status") WHERE ("has_upsell" = true);



CREATE INDEX "idx_post_media_post_id" ON "public"."post_media" USING "btree" ("post_id");



CREATE INDEX "idx_post_media_status" ON "public"."post_media" USING "btree" ("status");



CREATE INDEX "idx_post_media_tenant_id" ON "public"."post_media" USING "btree" ("tenant_id");



CREATE INDEX "idx_posts_format" ON "public"."posts" USING "btree" ("format");



CREATE INDEX "idx_posts_scheduled_date" ON "public"."posts" USING "btree" ("scheduled_date");



CREATE INDEX "idx_posts_status" ON "public"."posts" USING "btree" ("status");



CREATE INDEX "idx_posts_tenant_id" ON "public"."posts" USING "btree" ("tenant_id");



CREATE INDEX "idx_posts_tenant_status" ON "public"."posts" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_publish_log_queue" ON "public"."publish_log" USING "btree" ("publish_queue_id", "created_at");



CREATE INDEX "idx_publish_queue_pending" ON "public"."publish_queue" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'container_created'::"text"]));



CREATE INDEX "idx_publish_queue_process" ON "public"."publish_queue" USING "btree" ("tenant_id", "status", "scheduled_at");



CREATE INDEX "idx_quality_content" ON "public"."quality_scores" USING "btree" ("content_item_id");



CREATE INDEX "idx_quality_tenant" ON "public"."quality_scores" USING "btree" ("tenant_id");



CREATE INDEX "idx_retry_queue_pending" ON "public"."write_retry_queue" USING "btree" ("status", "next_retry") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_retry_queue_tenant" ON "public"."write_retry_queue" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_revision_requests_content_item" ON "public"."revision_requests" USING "btree" ("content_item_id");



CREATE INDEX "idx_revision_requests_tenant" ON "public"."revision_requests" USING "btree" ("tenant_id");



CREATE INDEX "idx_sentiment_tenant" ON "public"."sentiment_analysis" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_slots_queued_time" ON "public"."schedule_slots" USING "btree" ("scheduled_at") WHERE ("status" = 'queued'::"text");



CREATE INDEX "idx_slots_tenant_status_time" ON "public"."schedule_slots" USING "btree" ("tenant_id", "status", "scheduled_at");



CREATE INDEX "idx_social_conn_tenant" ON "public"."social_connections" USING "btree" ("tenant_id", "platform", "status");



CREATE INDEX "idx_stripe_subscriptions_stripe_id" ON "public"."stripe_subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_stripe_subscriptions_tenant" ON "public"."stripe_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscriptions_tenant" ON "public"."subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_system_prompts_created_by" ON "public"."system_prompts" USING "btree" ("created_by");



CREATE INDEX "idx_system_prompts_tenant" ON "public"."system_prompts" USING "btree" ("tenant_id");



CREATE INDEX "idx_system_prompts_tenant_active" ON "public"."system_prompts" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_tenant_members_invited_by" ON "public"."tenant_members" USING "btree" ("invited_by");



CREATE INDEX "idx_tenant_members_tenant" ON "public"."tenant_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_members_user" ON "public"."tenant_members" USING "btree" ("user_id");



CREATE INDEX "idx_tenants_depth" ON "public"."tenants" USING "btree" ("depth_level");



CREATE INDEX "idx_tenants_is_agency" ON "public"."tenants" USING "btree" ("is_agency") WHERE ("is_agency" = true);



CREATE INDEX "idx_tenants_owner" ON "public"."tenants" USING "btree" ("owner_id");



CREATE INDEX "idx_tenants_parent" ON "public"."tenants" USING "btree" ("parent_tenant_id");



CREATE INDEX "idx_token_cost_config_lookup" ON "public"."token_cost_config" USING "btree" ("tenant_id", "format", "operation");



CREATE INDEX "idx_token_usage_created" ON "public"."token_usage" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_token_usage_provider" ON "public"."token_usage" USING "btree" ("provider");



CREATE INDEX "idx_token_usage_session_type" ON "public"."token_usage" USING "btree" ("session_type");



CREATE INDEX "idx_token_usage_tenant" ON "public"."token_usage" USING "btree" ("tenant_id");



CREATE INDEX "idx_token_usage_tenant_created" ON "public"."token_usage" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_usage_log_tenant_month" ON "public"."schedule_usage_log" USING "btree" ("tenant_id", "billing_month");



CREATE INDEX "idx_usage_logs_tenant" ON "public"."usage_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_usage_logs_tenant_date_format" ON "public"."usage_logs" USING "btree" ("tenant_id", "created_at" DESC, "format");



CREATE INDEX "idx_wa_approval_events_post" ON "public"."wa_approval_events" USING "btree" ("post_id");



CREATE INDEX "idx_wa_approval_events_tenant" ON "public"."wa_approval_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_wa_approvers_tenant" ON "public"."wa_approvers" USING "btree" ("tenant_id");



CREATE OR REPLACE TRIGGER "posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_posts_updated_at"();



CREATE OR REPLACE TRIGGER "set_audience_analytics_updated_at" BEFORE UPDATE ON "public"."audience_analytics" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."ai_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."brand_dna" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."compliance_rules" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."content_items" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."marketplace_items" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."system_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_slots_updated_at" BEFORE UPDATE ON "public"."schedule_slots" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_depth_level" BEFORE INSERT OR UPDATE OF "parent_tenant_id" ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_depth_level"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_purchases"
    ADD CONSTRAINT "addon_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."addon_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addon_purchases"
    ADD CONSTRAINT "addon_purchases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_system_prompt_id_fkey" FOREIGN KEY ("system_prompt_id") REFERENCES "public"."system_prompts"("id");



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_sessions"
    ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."audience_analytics"
    ADD CONSTRAINT "audience_analytics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_billing_parent_id_fkey" FOREIGN KEY ("billing_parent_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."billing_contracts"
    ADD CONSTRAINT "billing_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_dna"
    ADD CONSTRAINT "brand_dna_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_rules"
    ADD CONSTRAINT "compliance_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."connected_accounts"
    ADD CONSTRAINT "connected_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_sessions"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_wallets"
    ADD CONSTRAINT "credit_wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."csv_registry"
    ADD CONSTRAINT "csv_registry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."csv_sync_log"
    ADD CONSTRAINT "csv_sync_log_csv_registry_id_fkey" FOREIGN KEY ("csv_registry_id") REFERENCES "public"."csv_registry"("id");



ALTER TABLE ONLY "public"."csv_sync_log"
    ADD CONSTRAINT "csv_sync_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."feedback_queue"
    ADD CONSTRAINT "feedback_queue_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_sessions"("id");



ALTER TABLE ONLY "public"."feedback_queue"
    ADD CONSTRAINT "feedback_queue_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id");



ALTER TABLE ONLY "public"."feedback_queue"
    ADD CONSTRAINT "feedback_queue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."marketplace_items"
    ADD CONSTRAINT "marketplace_items_seller_tenant_id_fkey" FOREIGN KEY ("seller_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_purchases"
    ADD CONSTRAINT "marketplace_purchases_buyer_tenant_id_fkey" FOREIGN KEY ("buyer_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_purchases"
    ADD CONSTRAINT "marketplace_purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items"("id");



ALTER TABLE ONLY "public"."mcp_connections"
    ADD CONSTRAINT "mcp_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mcp_connections"
    ADD CONSTRAINT "mcp_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."popup_events"
    ADD CONSTRAINT "popup_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_media"
    ADD CONSTRAINT "post_media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_config"
    ADD CONSTRAINT "pricing_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."publish_log"
    ADD CONSTRAINT "publish_log_publish_queue_id_fkey" FOREIGN KEY ("publish_queue_id") REFERENCES "public"."publish_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publish_queue"
    ADD CONSTRAINT "publish_queue_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."social_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publish_queue"
    ADD CONSTRAINT "publish_queue_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publish_queue"
    ADD CONSTRAINT "publish_queue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_scores"
    ADD CONSTRAINT "quality_scores_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quality_scores"
    ADD CONSTRAINT "quality_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revision_requests"
    ADD CONSTRAINT "revision_requests_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revision_requests"
    ADD CONSTRAINT "revision_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."schedule_usage_log"
    ADD CONSTRAINT "schedule_usage_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."sentiment_analysis"
    ADD CONSTRAINT "sentiment_analysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."social_connections"
    ADD CONSTRAINT "social_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."addons_catalog"("id");



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_config"
    ADD CONSTRAINT "tenant_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY ("parent_tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."token_cost_config"
    ADD CONSTRAINT "token_cost_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_usage"
    ADD CONSTRAINT "token_usage_ai_session_id_fkey" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_sessions"("id");



ALTER TABLE ONLY "public"."token_usage"
    ADD CONSTRAINT "token_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_approval_events"
    ADD CONSTRAINT "wa_approval_events_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."wa_approvers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wa_approval_events"
    ADD CONSTRAINT "wa_approval_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wa_approvers"
    ADD CONSTRAINT "wa_approvers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_retry_queue"
    ADD CONSTRAINT "write_retry_queue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



CREATE POLICY "Addon packages visiveis a todos" ON "public"."addon_packages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Agency CRUD own and children" ON "public"."schedule_slots" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("tm"."tenant_id" = "t"."id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 1) AND (("tm"."tenant_id" = "schedule_slots"."tenant_id") OR (EXISTS ( SELECT 1
           FROM "public"."tenants" "t_c"
          WHERE (("t_c"."id" = "schedule_slots"."tenant_id") AND ("t_c"."parent_tenant_id" = "tm"."tenant_id")))))))));



CREATE POLICY "Agency CRUD usage own and children" ON "public"."schedule_usage_log" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("tm"."tenant_id" = "t"."id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 1) AND (("tm"."tenant_id" = "schedule_usage_log"."tenant_id") OR (EXISTS ( SELECT 1
           FROM "public"."tenants" "t_c"
          WHERE (("t_c"."id" = "schedule_usage_log"."tenant_id") AND ("t_c"."parent_tenant_id" = "tm"."tenant_id")))))))));



CREATE POLICY "Agency manage own and children publish_queue" ON "public"."publish_queue" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 1) AND (("publish_queue"."tenant_id" = "tm"."tenant_id") OR ("publish_queue"."tenant_id" IN ( SELECT "tenants"."id"
           FROM "public"."tenants"
          WHERE ("tenants"."parent_tenant_id" = "tm"."tenant_id"))))))));



CREATE POLICY "Agency manage own and children social_connections" ON "public"."social_connections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 1) AND (("social_connections"."tenant_id" = "tm"."tenant_id") OR ("social_connections"."tenant_id" IN ( SELECT "tenants"."id"
           FROM "public"."tenants"
          WHERE ("tenants"."parent_tenant_id" = "tm"."tenant_id"))))))));



CREATE POLICY "Allow read of global activity_log" ON "public"."activity_log" FOR SELECT TO "authenticated", "anon" USING (("tenant_id" IS NULL));



CREATE POLICY "Allow read of global popup_events" ON "public"."popup_events" FOR SELECT TO "authenticated", "anon" USING (("tenant_id" IS NULL));



CREATE POLICY "Audience: Enable read access for tenant members" ON "public"."audience_analytics" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Audience: Enable write access for agency operators" ON "public"."audience_analytics" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))) AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'genOS_role'::"text") = ANY (ARRAY['Workplace'::"text", 'Enterprise'::"text"]))));



CREATE POLICY "Authenticated users can insert ai_sessions" ON "public"."ai_sessions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert content_items" ON "public"."content_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can view own tenant logs" ON "public"."activity_log" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Client SELECT own only" ON "public"."schedule_slots" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Client SELECT usage own only" ON "public"."schedule_usage_log" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Client read own publish_queue" ON "public"."publish_queue" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "Client read own social_connections" ON "public"."social_connections" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "DNA: Enable read access for tenant members" ON "public"."brand_dna" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "DNA: Enable write access for agency operators" ON "public"."brand_dna" TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))) AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'genOS_role'::"text") = ANY (ARRAY['Workplace'::"text", 'Enterprise'::"text"]))));



CREATE POLICY "Hierarchical Billing Visibility" ON "public"."billing_contracts" USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Brand DNA Modification" ON "public"."brand_dna" USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Brand DNA Visibility" ON "public"."brand_dna" FOR SELECT USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Config Visibility" ON "public"."tenant_config" USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Posts Modification" ON "public"."posts" USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Posts Visibility" ON "public"."posts" FOR SELECT USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Tenant Members Visibility" ON "public"."tenant_members" FOR SELECT USING ("public"."is_authorized_for_tenant"("tenant_id"));



CREATE POLICY "Hierarchical Tenant Modification" ON "public"."tenants" USING ("public"."is_authorized_for_tenant"("id"));



CREATE POLICY "Hierarchical Tenant Visibility" ON "public"."tenants" FOR SELECT USING ("public"."is_authorized_for_tenant"("id"));



CREATE POLICY "Master CRUD everything" ON "public"."schedule_slots" TO "authenticated" USING ("public"."is_master"());



CREATE POLICY "Master CRUD usage" ON "public"."schedule_usage_log" TO "authenticated" USING ("public"."is_master"());



CREATE POLICY "Master full access publish_log" ON "public"."publish_log" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 0)))));



CREATE POLICY "Master full access publish_queue" ON "public"."publish_queue" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 0)))));



CREATE POLICY "Master full access social_connections" ON "public"."social_connections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tenant_members" "tm"
     JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."depth_level" = 0)))));



CREATE POLICY "Public can view active applications" ON "public"."applications" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Schedule Slots RLS Policy" ON "public"."schedule_slots" TO "authenticated" USING (("public"."is_master"() OR ((( SELECT "tenants"."depth_level"
   FROM "public"."tenants"
  WHERE ("tenants"."id" = "schedule_slots"."tenant_id")) = 1) AND ("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"())))) OR ("tenant_id" IN ( SELECT "tenants"."id"
   FROM "public"."tenants"
  WHERE ("tenants"."parent_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
           FROM "public"."tenant_members"
          WHERE ("tenant_members"."user_id" = "auth"."uid"()))))) OR ("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))))) WITH CHECK (("public"."is_master"() OR "public"."can_manage_tenant"("tenant_id")));



CREATE POLICY "Tenant isolation for audience_analytics" ON "public"."audience_analytics" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tenant read own publish_log" ON "public"."publish_log" FOR SELECT TO "authenticated" USING (("publish_queue_id" IN ( SELECT "pq"."id"
   FROM "public"."publish_queue" "pq"
  WHERE ("pq"."tenant_id" IN ( SELECT "tm"."tenant_id"
           FROM "public"."tenant_members" "tm"
          WHERE ("tm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Tenants can view own contracts" ON "public"."billing_contracts" FOR SELECT USING (("tenant_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Tenants can view own popup_events" ON "public"."popup_events" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tenants can view own subscriptions" ON "public"."subscriptions" FOR SELECT USING (("tenant_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Tenants can view own wallet" ON "public"."credit_wallets" FOR SELECT USING (("tenant_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own tenant usage logs" ON "public"."usage_logs" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addon_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."addons_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "addons_catalog_public_read" ON "public"."addons_catalog" FOR SELECT USING (true);



CREATE POLICY "addons_observatory" ON "public"."tenant_addons" USING ("public"."is_observatory_member"("auth"."uid"()));



CREATE POLICY "addons_service_role" ON "public"."tenant_addons" USING (true) WITH CHECK (true);



CREATE POLICY "addons_tenant" ON "public"."tenant_addons" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "agency_read_descendants" ON "public"."tenants" FOR SELECT USING ((("id" IN ( SELECT "public"."get_tenant_descendants"('056fbab6-3d03-4ceb-94a4-d91338f514b8'::"uuid") AS "get_tenant_descendants")) OR ("id" = '056fbab6-3d03-4ceb-94a4-d91338f514b8'::"uuid")));



ALTER TABLE "public"."ai_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_sessions_insert" ON "public"."ai_sessions" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "anon_insert_csv_sync_log" ON "public"."csv_sync_log" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_feedback_queue" ON "public"."feedback_queue" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audience_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_insert_csv" ON "public"."csv_sync_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "auth_insert_feedback" ON "public"."feedback_queue" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."billing_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_tenant_admin_write" ON "public"."billing_accounts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("tm"."tenant_id" = "billing_accounts"."tenant_id") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "billing_tenant_read" ON "public"."billing_accounts" FOR SELECT TO "authenticated" USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."brand_dna" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connected_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_delete" ON "public"."content_items" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text", 'tenant_admin'::"text"]))))));



CREATE POLICY "content_insert" ON "public"."content_items" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text", 'tenant_admin'::"text", 'tenant_editor'::"text"]))))));



ALTER TABLE "public"."content_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_read" ON "public"."content_items" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "content_update" ON "public"."content_items" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text", 'tenant_admin'::"text"]))))));



ALTER TABLE "public"."credit_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."csv_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."csv_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_read" ON "public"."activity_log" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text", 'tenant_admin'::"text"]))))));



ALTER TABLE "public"."marketplace_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_public_read" ON "public"."marketplace_items" FOR SELECT USING ((("status" = 'published'::"text") OR ("seller_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."marketplace_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_seller_delete" ON "public"."marketplace_items" FOR DELETE USING (("seller_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text"]))))));



CREATE POLICY "marketplace_seller_update" ON "public"."marketplace_items" FOR UPDATE USING (("seller_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text"]))))));



CREATE POLICY "marketplace_seller_write" ON "public"."marketplace_items" FOR INSERT WITH CHECK (("seller_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("tenant_members"."role" = ANY (ARRAY['sys_admin'::"text", 'agency_admin'::"text"]))))));



ALTER TABLE "public"."mcp_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "observatory_manage_pricing" ON "public"."pricing_config" USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all" ON "public"."tenants" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_brand_dna" ON "public"."brand_dna" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_compliance" ON "public"."compliance_rules" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_content" ON "public"."content_items" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_csv_registry" ON "public"."csv_registry" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_feedback" ON "public"."feedback_queue" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_sessions" ON "public"."ai_sessions" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



CREATE POLICY "observatory_read_all_token_usage" ON "public"."token_usage" FOR SELECT USING ("public"."is_observatory_member"('e80044d4-2905-4a4a-bfaf-b492d630407e'::"uuid"));



ALTER TABLE "public"."popup_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "popup_observatory" ON "public"."popup_events" FOR SELECT USING ("public"."is_observatory_member"("auth"."uid"()));



CREATE POLICY "popup_service_role" ON "public"."popup_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "popup_tenant" ON "public"."popup_events" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."post_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_media_delete_own_tenant" ON "public"."post_media" FOR DELETE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "post_media_insert_own_tenant" ON "public"."post_media" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'owner'::"text"]))))));



CREATE POLICY "post_media_select_own_tenant" ON "public"."post_media" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid"))));



CREATE POLICY "post_media_update_own_tenant" ON "public"."post_media" FOR UPDATE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid"))));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_own_tenant" ON "public"."posts" FOR DELETE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "posts_insert_own_tenant" ON "public"."posts" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'owner'::"text", 'client_user'::"text"]))))));



CREATE POLICY "posts_select_own_tenant" ON "public"."posts" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid"))));



CREATE POLICY "posts_update_own_tenant" ON "public"."posts" FOR UPDATE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."user_id" = ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'user_id'::"text"))::"uuid") AND ("tm"."role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'owner'::"text", 'client_user'::"text"]))))));



ALTER TABLE "public"."pricing_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_config_service_all" ON "public"."pricing_config" USING (true) WITH CHECK (true);



ALTER TABLE "public"."publish_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publish_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchases_read" ON "public"."marketplace_purchases" FOR SELECT USING ((("buyer_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("item_id" IN ( SELECT "marketplace_items"."id"
   FROM "public"."marketplace_items"
  WHERE ("marketplace_items"."seller_tenant_id" IN ( SELECT "tenant_members"."tenant_id"
           FROM "public"."tenant_members"
          WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."quality_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quality_scores_all" ON "public"."quality_scores" USING (true) WITH CHECK (true);



ALTER TABLE "public"."revision_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_usage_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sentiment_analysis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sentiment_analysis_all" ON "public"."sentiment_analysis" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all" ON "public"."activity_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full_access" ON "public"."ai_sessions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."brand_dna" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."compliance_rules" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."connected_accounts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."content_items" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."csv_registry" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."csv_sync_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."feedback_queue" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."marketplace_items" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."marketplace_purchases" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."mcp_connections" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."system_prompts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."tenant_members" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_full_access" ON "public"."write_retry_queue" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_revisions" ON "public"."revision_requests" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."social_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_subscriptions_tenant_read" ON "public"."stripe_subscriptions" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_config_insert" ON "public"."tenant_config" FOR INSERT WITH CHECK (true);



CREATE POLICY "tenant_config_select" ON "public"."tenant_config" FOR SELECT USING (true);



CREATE POLICY "tenant_config_update" ON "public"."tenant_config" FOR UPDATE USING (true);



CREATE POLICY "tenant_insert" ON "public"."tenants" FOR INSERT WITH CHECK (true);



CREATE POLICY "tenant_isolation" ON "public"."ai_sessions" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation" ON "public"."brand_dna" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation" ON "public"."compliance_rules" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation" ON "public"."connected_accounts" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation" ON "public"."mcp_connections" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation" ON "public"."system_prompts" USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "tenant_isolation_delete" ON "public"."csv_registry" FOR DELETE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_insert" ON "public"."addon_purchases" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_insert" ON "public"."csv_registry" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_insert" ON "public"."csv_sync_log" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_insert" ON "public"."feedback_queue" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_insert" ON "public"."write_retry_queue" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_select" ON "public"."addon_purchases" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_select" ON "public"."csv_registry" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_select" ON "public"."csv_sync_log" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_select" ON "public"."feedback_queue" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_select" ON "public"."write_retry_queue" FOR SELECT USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_update" ON "public"."addon_purchases" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_members"."tenant_id"
   FROM "public"."tenant_members"
  WHERE ("tenant_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_update" ON "public"."csv_registry" FOR UPDATE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_update" ON "public"."feedback_queue" FOR UPDATE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_update" ON "public"."write_retry_queue" FOR UPDATE USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."tenant_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_members_own" ON "public"."tenant_members" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "tenant_read_active" ON "public"."tenants" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "tenant_update_active" ON "public"."tenants" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_cost_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "token_cost_config_master_write" ON "public"."token_cost_config" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members"
  WHERE (("tenant_members"."user_id" = "auth"."uid"()) AND ("tenant_members"."role" = 'master'::"text")))));



CREATE POLICY "token_cost_config_select_all" ON "public"."token_cost_config" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."token_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "token_usage_service_all" ON "public"."token_usage" USING (true) WITH CHECK (true);



CREATE POLICY "token_usage_tenant_read" ON "public"."token_usage" FOR SELECT USING ((("tenant_id" = ("current_setting"('app.current_tenant_id'::"text", true))::"uuid") OR "public"."is_observatory_member"(("current_setting"('app.current_tenant_id'::"text", true))::"uuid")));



ALTER TABLE "public"."usage_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_approval_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_approval_events_tenant_access" ON "public"."wa_approval_events" USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."wa_approvers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_approvers_tenant_access" ON "public"."wa_approvers" USING (("tenant_id" IN ( SELECT "tm"."tenant_id"
   FROM "public"."tenant_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."write_retry_queue" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."apply_addon_package"("p_purchase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_addon_package"("p_purchase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_addon_package"("p_purchase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_agent_envelope"("p_tenant_id" "uuid", "p_prompt_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_depth_level"("tenant_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_depth_level"("tenant_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_depth_level"("tenant_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_token_cost"("p_tenant_id" "uuid", "p_format" "text", "p_operation" "text", "p_slide_count" integer, "p_ai_model" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_token_cost"("p_tenant_id" "uuid", "p_format" "text", "p_operation" "text", "p_slide_count" integer, "p_ai_model" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_token_cost"("p_tenant_id" "uuid", "p_format" "text", "p_operation" "text", "p_slide_count" integer, "p_ai_model" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_tenant"("accessor_id" "uuid", "target_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_tenant"("accessor_id" "uuid", "target_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_tenant"("accessor_id" "uuid", "target_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_tenant"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_tenant"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_tenant"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_can_generate"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_can_generate"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_can_generate"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_permission"("p_tenant_id" "uuid", "p_required_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_schedule_limit"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_schedule_limit"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_schedule_limit"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debit_credits"("p_tenant_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_tenant_member"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_tenant_member"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_tenant_member"("p_user_id" "uuid", "p_tenant_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_popups"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_popups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_popups"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_agent_envelope_service"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_agent_envelope_service"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_dna"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_social_token"("p_secret_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_social_token"("p_secret_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_social_token"("p_secret_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_ancestors"("child_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_descendants"("root_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authorized_for_tenant"("target_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_authorized_for_tenant"("target_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authorized_for_tenant"("target_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_master"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_master"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_master"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_observatory_member"("check_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_observatory_member"("check_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_observatory_member"("check_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sys_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_sys_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sys_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."provision_tenant_member"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."provision_tenant_member"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provision_tenant_member"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_social_token"("p_tenant_id" "uuid", "p_platform" "text", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."store_social_token"("p_tenant_id" "uuid", "p_platform" "text", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_social_token"("p_tenant_id" "uuid", "p_platform" "text", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_depth_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_depth_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_depth_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."addon_packages" TO "anon";
GRANT ALL ON TABLE "public"."addon_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_packages" TO "service_role";



GRANT ALL ON TABLE "public"."addon_purchases" TO "anon";
GRANT ALL ON TABLE "public"."addon_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."addon_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."addons_catalog" TO "anon";
GRANT ALL ON TABLE "public"."addons_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."addons_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."ai_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."audience_analytics" TO "anon";
GRANT ALL ON TABLE "public"."audience_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."audience_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."billing_accounts" TO "anon";
GRANT ALL ON TABLE "public"."billing_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."billing_contracts" TO "anon";
GRANT ALL ON TABLE "public"."billing_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."brand_dna" TO "anon";
GRANT ALL ON TABLE "public"."brand_dna" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_dna" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_rules" TO "anon";
GRANT ALL ON TABLE "public"."compliance_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_rules" TO "service_role";



GRANT ALL ON TABLE "public"."connected_accounts" TO "anon";
GRANT ALL ON TABLE "public"."connected_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."connected_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."content_items" TO "anon";
GRANT ALL ON TABLE "public"."content_items" TO "authenticated";
GRANT ALL ON TABLE "public"."content_items" TO "service_role";



GRANT ALL ON TABLE "public"."credit_wallets" TO "anon";
GRANT ALL ON TABLE "public"."credit_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."csv_registry" TO "anon";
GRANT ALL ON TABLE "public"."csv_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."csv_registry" TO "service_role";



GRANT ALL ON TABLE "public"."csv_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."csv_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."csv_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_queue" TO "anon";
GRANT ALL ON TABLE "public"."feedback_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_queue" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_items" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_items" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_purchases" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_connections" TO "anon";
GRANT ALL ON TABLE "public"."mcp_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_connections" TO "service_role";



GRANT ALL ON TABLE "public"."popup_events" TO "anon";
GRANT ALL ON TABLE "public"."popup_events" TO "authenticated";
GRANT ALL ON TABLE "public"."popup_events" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_popup_analytics" TO "anon";
GRANT ALL ON TABLE "public"."observatory_popup_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_popup_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_addons" TO "anon";
GRANT ALL ON TABLE "public"."tenant_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_addons" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_popup_revenue" TO "anon";
GRANT ALL ON TABLE "public"."observatory_popup_revenue" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_popup_revenue" TO "service_role";



GRANT ALL ON TABLE "public"."post_media" TO "anon";
GRANT ALL ON TABLE "public"."post_media" TO "authenticated";
GRANT ALL ON TABLE "public"."post_media" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_config" TO "anon";
GRANT ALL ON TABLE "public"."pricing_config" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_config" TO "service_role";



GRANT ALL ON TABLE "public"."publish_log" TO "anon";
GRANT ALL ON TABLE "public"."publish_log" TO "authenticated";
GRANT ALL ON TABLE "public"."publish_log" TO "service_role";



GRANT ALL ON TABLE "public"."publish_queue" TO "anon";
GRANT ALL ON TABLE "public"."publish_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."publish_queue" TO "service_role";



GRANT ALL ON TABLE "public"."quality_scores" TO "anon";
GRANT ALL ON TABLE "public"."quality_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_scores" TO "service_role";



GRANT ALL ON TABLE "public"."revision_requests" TO "anon";
GRANT ALL ON TABLE "public"."revision_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."revision_requests" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_slots" TO "anon";
GRANT ALL ON TABLE "public"."schedule_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_slots" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."schedule_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."sentiment_analysis" TO "anon";
GRANT ALL ON TABLE "public"."sentiment_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."sentiment_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."social_connections" TO "anon";
GRANT ALL ON TABLE "public"."social_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."social_connections" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."system_prompts" TO "anon";
GRANT ALL ON TABLE "public"."system_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."system_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_config" TO "anon";
GRANT ALL ON TABLE "public"."tenant_config" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_config" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_members" TO "anon";
GRANT ALL ON TABLE "public"."tenant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."token_cost_config" TO "anon";
GRANT ALL ON TABLE "public"."token_cost_config" TO "authenticated";
GRANT ALL ON TABLE "public"."token_cost_config" TO "service_role";



GRANT ALL ON TABLE "public"."token_usage" TO "anon";
GRANT ALL ON TABLE "public"."token_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."token_usage" TO "service_role";



GRANT ALL ON TABLE "public"."usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_alerts" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_daily_usage" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_daily_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_daily_usage" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_model_breakdown" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_model_breakdown" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_model_breakdown" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_profitability" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_profitability" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_profitability" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_tenant_costs" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_tenant_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_tenant_costs" TO "service_role";



GRANT ALL ON TABLE "public"."v_observatory_token_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_observatory_token_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_observatory_token_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_user_tenant_roles" TO "anon";
GRANT ALL ON TABLE "public"."v_user_tenant_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."v_user_tenant_roles" TO "service_role";



GRANT ALL ON TABLE "public"."wa_approval_events" TO "anon";
GRANT ALL ON TABLE "public"."wa_approval_events" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_approval_events" TO "service_role";



GRANT ALL ON TABLE "public"."wa_approvers" TO "anon";
GRANT ALL ON TABLE "public"."wa_approvers" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_approvers" TO "service_role";



GRANT ALL ON TABLE "public"."write_retry_queue" TO "anon";
GRANT ALL ON TABLE "public"."write_retry_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."write_retry_queue" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































