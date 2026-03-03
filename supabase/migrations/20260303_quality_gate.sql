-- ============================================================
-- genOS Lumina — Migration: Quality Gate (Governance Queue)
-- Target: Supabase Postgres
-- ============================================================

-- 1. Constraint Rules Table
CREATE TABLE IF NOT EXISTS constraint_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'character_count',
        'hashtag_count',
        'tone_adherence',
        'frame_limit',
        'forbidden_words',
        'cta_required',
        'language_check',
        'brand_voice_score'
    )),
    format_target TEXT DEFAULT 'all', -- feed, carrossel, stories, reels, all
    config JSONB NOT NULL, -- e.g., {"min": 100, "max": 280}
    severity TEXT DEFAULT 'violation' CHECK (severity IN ('violation', 'warning', 'info')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, rule_type, format_target)
);

-- 2. Quality Evaluations Table
CREATE TABLE IF NOT EXISTS quality_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    overall_score NUMERIC(5,2) DEFAULT 0, -- 0 to 100
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'exception_approved')),
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    evaluated_by TEXT DEFAULT 'system', -- 'system' or user_uuid
    reason_exception TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Constraint Results Table
CREATE TABLE IF NOT EXISTS constraint_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES quality_evaluations(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES constraint_rules(id) ON DELETE CASCADE,
    passed BOOLEAN NOT NULL,
    actual_value TEXT,
    expected_value TEXT,
    severity TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS POLICIES

ALTER TABLE constraint_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraint_results ENABLE ROW LEVEL SECURITY;

-- constraint_rules: Master CRUD all, Agency CRUD own + tree, Client SELECT own
CREATE POLICY "Master/Agency/Client access on constraint_rules" ON constraint_rules
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tenant_members m
            JOIN tenants t ON m.tenant_id = t.id
            WHERE m.user_id = auth.uid()
            AND (
                t.depth_level = 0 -- Master
                OR (t.depth_level = 1 AND (constraint_rules.tenant_id = t.id OR EXISTS (SELECT 1 FROM tenants child WHERE child.id = constraint_rules.tenant_id AND child.parent_id = t.id))) -- Agency
                OR (constraint_rules.tenant_id = m.tenant_id) -- Client
            )
        )
    );

-- quality_evaluations policies
CREATE POLICY "Multi-tenant access on quality_evaluations" ON quality_evaluations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tenant_members m
            WHERE m.user_id = auth.uid()
            AND (
                EXISTS (SELECT 1 FROM tenants t WHERE t.id = m.tenant_id AND t.depth_level = 0)
                OR (EXISTS (SELECT 1 FROM tenants t WHERE t.id = m.tenant_id AND t.depth_level = 1) AND (quality_evaluations.tenant_id = m.tenant_id OR EXISTS (SELECT 1 FROM tenants child WHERE child.id = quality_evaluations.tenant_id AND child.parent_id = m.tenant_id)))
                OR (quality_evaluations.tenant_id = m.tenant_id)
            )
        )
    );

-- constraint_results policies (follows evaluation access)
CREATE POLICY "Access on constraint_results via evaluations" ON constraint_results
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM quality_evaluations e
            WHERE e.id = constraint_results.evaluation_id
        )
    );

-- 5. FUNCTION: seed_default_constraints
CREATE OR REPLACE FUNCTION seed_default_constraints(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    v_dna JSONB;
BEGIN
    SELECT row_to_json(bd)::jsonb INTO v_dna FROM brand_dna bd WHERE tenant_id = p_tenant_id;
    
    IF v_dna IS NULL THEN
        RETURN;
    END IF;

    -- Feed Char Limit
    INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
    VALUES (p_tenant_id, 'character_count', 'feed', jsonb_build_object('max', COALESCE((v_dna->'char_limits'->>'estatico_legenda')::int, 2200)), 'violation')
    ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;

    -- Stories Char Limit
    INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
    VALUES (p_tenant_id, 'character_count', 'stories', jsonb_build_object('max', 250), 'violation')
    ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;

    -- Reels Title Limit
    INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
    VALUES (p_tenant_id, 'character_count', 'reels', jsonb_build_object('max', COALESCE((v_dna->'char_limits'->>'reel_titulo')::int, 100)), 'violation')
    ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;

    -- Hashtag Max
    INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
    VALUES (p_tenant_id, 'hashtag_count', 'all', jsonb_build_object('max', COALESCE((v_dna->'hashtag_strategy'->>'max_total')::int, 30)), 'warning')
    ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;

    -- Forbidden Words
    IF v_dna->'forbidden_words' IS NOT NULL AND jsonb_array_length(v_dna->'forbidden_words') > 0 THEN
        INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
        VALUES (p_tenant_id, 'forbidden_words', 'all', jsonb_build_object('words', v_dna->'forbidden_words'), 'violation')
        ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;
    END IF;

    -- Tone Adherence (Default 0.75)
    INSERT INTO constraint_rules (tenant_id, rule_type, format_target, config, severity)
    VALUES (p_tenant_id, 'tone_adherence', 'all', '{"threshold": 0.75}', 'warning')
    ON CONFLICT (tenant_id, rule_type, format_target) DO UPDATE SET config = EXCLUDED.config;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCTION: evaluate_post (SQL Trigger Helper)
-- This function will perform the deterministic checks. 
-- Complex AI checks (tone, brand voice) must be done via Edge Function / Worker.
CREATE OR REPLACE FUNCTION evaluate_post_sql(p_post_id UUID)
RETURNS UUID AS $$
DECLARE
    v_post RECORD;
    v_rule RECORD;
    v_evaluation_id UUID;
    v_passed BOOLEAN;
    v_actual TEXT;
    v_expected TEXT;
    v_score NUMERIC := 100;
    v_violations INT := 0;
    v_total_rules INT := 0;
    v_content TEXT;
BEGIN
    SELECT * INTO v_post FROM posts WHERE id = p_post_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Create evaluation record
    INSERT INTO quality_evaluations (post_id, tenant_id, status)
    VALUES (v_post.id, v_post.tenant_id, 'pending')
    RETURNING id INTO v_evaluation_id;

    v_content := COALESCE(v_post.title, '') || ' ' || COALESCE(v_post.body, '');

    FOR v_rule IN 
        SELECT * FROM constraint_rules 
        WHERE tenant_id = v_post.tenant_id 
        AND enabled = true 
        AND (format_target = v_post.content_type OR format_target = 'all')
    LOOP
        v_total_rules := v_total_rules + 1;
        v_passed := true;
        v_actual := '';
        v_expected := '';

        CASE v_rule.rule_type
            WHEN 'character_count' THEN
                v_actual := length(v_content)::text;
                v_expected := v_rule.config->>'max';
                IF length(v_content) > (v_rule.config->>'max')::int THEN
                    v_passed := false;
                END IF;

            WHEN 'hashtag_count' THEN
                -- Rough count of # in content
                v_actual := (array_length(regexp_split_to_array(v_content, '#'), 1) - 1)::text;
                v_expected := v_rule.config->>'max';
                IF (v_actual::int) > (v_rule.config->>'max')::int THEN
                    v_passed := false;
                END IF;

            WHEN 'forbidden_words' THEN
                -- Check if any word from config.words exists in content
                SELECT INTO v_passed NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(v_rule.config->'words') AS word
                    WHERE v_content ~* word
                );
                IF NOT v_passed THEN
                    v_actual := 'Forbidden words detected';
                END IF;

            ELSE
                -- tone_adherence, brand_voice, etc. marked as pending/skipped in SQL
                -- These will be handled by the Edge Function
                CONTINUE; 
        END CASE;

        INSERT INTO constraint_results (evaluation_id, rule_id, passed, actual_value, expected_value, severity)
        VALUES (v_evaluation_id, v_rule.id, v_passed, v_actual, v_expected, v_rule.severity);

        IF NOT v_passed AND v_rule.severity = 'violation' THEN
            v_violations := v_violations + 1;
            v_score := v_score - 20;
        ELSIF NOT v_passed AND v_rule.severity = 'warning' THEN
            v_score := v_score - 5;
        END IF;
    END LOOP;

    -- Final status check
    UPDATE quality_evaluations 
    SET overall_score = GREATEST(0, v_score),
        status = CASE WHEN v_violations = 0 AND v_score >= 80 THEN 'passed' ELSE 'failed' END
    WHERE id = v_evaluation_id;

    RETURN v_evaluation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TRIGGER: after INSERT on posts
CREATE OR REPLACE FUNCTION trigger_evaluate_post()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM evaluate_post_sql(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_evaluate_post ON posts;
CREATE TRIGGER tr_evaluate_post
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION trigger_evaluate_post();
