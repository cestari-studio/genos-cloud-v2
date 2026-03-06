-- ═══════════════════════════════════════
-- 1. Melhorar post_media
-- ═══════════════════════════════════════

ALTER TABLE post_media ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS storage_path TEXT; -- path real no bucket (sem URL prefix)
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS original_file_name TEXT; -- nome original do upload
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS uploaded_by UUID;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT now();

-- Constraint: position único por post
ALTER TABLE post_media DROP CONSTRAINT IF EXISTS post_media_unique_position;
ALTER TABLE post_media ADD CONSTRAINT post_media_unique_position UNIQUE (post_id, position);

-- ═══════════════════════════════════════
-- 6. Habilitar unaccent extension (precisa estar antes da function)
-- ═══════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ═══════════════════════════════════════
-- 2. Função de nomenclatura padrão
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_media_filename(
  p_tenant_name TEXT,
  p_scheduled_date TIMESTAMPTZ,
  p_post_id UUID,
  p_position INTEGER,
  p_extension TEXT
) RETURNS TEXT AS $$
DECLARE
  v_clean_name TEXT;
  v_date_str TEXT;
  v_post_short TEXT;
BEGIN
  -- Sanitizar nome do tenant (remover espaços, acentos, caracteres especiais)
  v_clean_name := regexp_replace(
    unaccent(p_tenant_name),
    '[^a-zA-Z0-9]', '', 'g'
  );
  
  -- Formatar data (usar created_at do post se scheduled_date for NULL)
  v_date_str := to_char(COALESCE(p_scheduled_date, now()), 'YYYY-MM-DD');
  
  -- Primeiros 8 chars do UUID do post
  v_post_short := left(p_post_id::text, 8);
  
  -- Formato final: TenantName-2026-03-15-a1b2c3d4-01.jpg
  RETURN v_clean_name || '-' || v_date_str || '-' || v_post_short || '-' || 
         lpad(p_position::text, 2, '0') || '.' || lower(p_extension);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════
-- 3. Trigger: Rename mídias ao alterar scheduled_date do post
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_rename_media_on_post_update()
RETURNS TRIGGER AS $$
DECLARE
  v_media RECORD;
  v_tenant_name TEXT;
  v_new_filename TEXT;
  v_new_path TEXT;
  v_ext TEXT;
BEGIN
  -- Só executa se scheduled_date mudou
  IF OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date THEN
    -- Buscar nome do tenant
    SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
    
    -- Para cada mídia do post
    FOR v_media IN 
      SELECT * FROM post_media WHERE post_id = NEW.id AND storage_path IS NOT NULL
    LOOP
      -- Extrair extensão
      v_ext := split_part(v_media.file_name, '.', -1);
      
      -- Gerar novo nome
      v_new_filename := generate_media_filename(
        v_tenant_name, NEW.scheduled_date, NEW.id, v_media.position, v_ext
      );
      
      -- Novo path no storage
      v_new_path := NEW.tenant_id || '/' || NEW.id || '/' || v_new_filename;
      
      -- Atualizar registro (o move no Storage será feito pela Edge Function)
      UPDATE post_media 
      SET file_name = v_new_filename,
          storage_path = v_new_path
      WHERE id = v_media.id;
    END LOOP;
    
    -- Criar evento para Edge Function processar os moves no Storage
    INSERT INTO activity_log (tenant_id, category, action, details)
    VALUES (NEW.tenant_id, 'media', 'rename_required', jsonb_build_object(
      'post_id', NEW.id,
      'reason', 'scheduled_date_changed',
      'old_date', OLD.scheduled_date,
      'new_date', NEW.scheduled_date
    ));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rename_media_on_post_update ON posts;
CREATE TRIGGER trg_rename_media_on_post_update
  AFTER UPDATE ON posts
  FOR EACH ROW
  WHEN (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date)
  EXECUTE FUNCTION trigger_rename_media_on_post_update();

-- ═══════════════════════════════════════
-- 4. Trigger: Rename mídias ao alterar nome do tenant
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_rename_media_on_tenant_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    -- Criar evento para Edge Function processar batch rename
    INSERT INTO activity_log (tenant_id, category, action, details)
    VALUES (NEW.id, 'media', 'batch_rename_required', jsonb_build_object(
      'reason', 'tenant_name_changed',
      'old_name', OLD.name,
      'new_name', NEW.name
    ));
    
    -- Atualizar file_name de todas as mídias de todos os posts deste tenant
    UPDATE post_media pm
    SET file_name = generate_media_filename(
      NEW.name,
      p.scheduled_date,
      p.id,
      pm.position,
      split_part(pm.file_name, '.', -1)
    ),
    storage_path = p.tenant_id || '/' || p.id || '/' || generate_media_filename(
      NEW.name,
      p.scheduled_date,
      p.id,
      pm.position,
      split_part(pm.file_name, '.', -1)
    )
    FROM posts p
    WHERE pm.post_id = p.id AND p.tenant_id = NEW.id AND pm.storage_path IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rename_media_on_tenant_update ON tenants;
CREATE TRIGGER trg_rename_media_on_tenant_update
  AFTER UPDATE ON tenants
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION trigger_rename_media_on_tenant_update();

-- ═══════════════════════════════════════
-- 5. RLS para post_media
-- ═══════════════════════════════════════

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

-- Master: vê tudo
DROP POLICY IF EXISTS post_media_master_all ON post_media;
CREATE POLICY post_media_master_all ON post_media
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN tenant_members tm ON tm.tenant_id IN (
        SELECT id FROM tenants WHERE depth_level = 0
      )
      WHERE p.id = post_media.post_id
      AND tm.user_id = auth.uid()
    )
  );

-- Agency: vê próprio + filhos
DROP POLICY IF EXISTS post_media_agency ON post_media;
CREATE POLICY post_media_agency ON post_media
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN tenant_members tm ON tm.user_id = auth.uid()
      WHERE p.id = post_media.post_id
      AND (t.id = tm.tenant_id OR t.parent_tenant_id = tm.tenant_id)
    )
  );

-- Client: vê próprio
DROP POLICY IF EXISTS post_media_client ON post_media;
CREATE POLICY post_media_client ON post_media
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN tenant_members tm ON tm.tenant_id = p.tenant_id
      WHERE p.id = post_media.post_id
      AND tm.user_id = auth.uid()
    )
  );
