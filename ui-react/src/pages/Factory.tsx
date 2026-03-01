// genOS Lumina — Content Factory (Addendum H §8.4)
import { useState } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  NumberInput,
  DatePicker,
  DatePickerInput,
  Button,
  InlineLoading,
  Section,
  Grid,
  Column,
} from '@carbon/react';
import { MagicWandFilled } from '@carbon/icons-react';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from '../components/PageLayout';
import MatrixList from '../components/ContentFactory/MatrixList';
import { useNotifications } from '../components/NotificationProvider';

type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';

interface NewPostForm {
  format: PostFormat;
  title: string;
  description: string;
  scheduled_date: string;
  hashtags: string;
  cta: string;
  media_slots: number;
  ai_instructions: string;
}

const EMPTY_FORM: NewPostForm = {
  format: 'feed',
  title: '',
  description: '',
  scheduled_date: '',
  hashtags: '',
  cta: '',
  media_slots: 1,
  ai_instructions: '',
};

const MEDIA_SLOTS_BY_FORMAT: Record<PostFormat, number> = {
  feed: 1,
  carrossel: 5,
  stories: 1,
  reels: 1,
};

export default function Factory() {
  const { showToast } = useNotifications();
  const { me: { tenant } } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPostForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const update = (field: keyof NewPostForm, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Auto-adjust media_slots when format changes
      if (field === 'format') {
        next.media_slots = MEDIA_SLOTS_BY_FORMAT[value as PostFormat] || 1;
      }
      return next;
    });
  };

  const openModal = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('Campo obrigatório', 'Informe o título do post.', 'warning');
      return;
    }
    if (!tenant?.id) {
      showToast('Sem tenant', 'Selecione um workspace ativo.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('posts').insert({
        tenant_id: tenant.id,
        format: form.format,
        status: 'draft',
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduled_date: form.scheduled_date || null,
        hashtags: form.hashtags.trim() || null,
        cta: form.cta.trim() || null,
        card_data: form.format === 'carrossel' ? [] : null,
        media_slots: form.media_slots,
        ai_instructions: form.ai_instructions.trim() || null,
      });

      if (error) throw error;

      showToast('Post criado', `"${form.title}" adicionado como rascunho.`, 'success');
      setShowModal(false);
    } catch (err: any) {
      showToast('Erro ao criar post', String(err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!form.title.trim()) {
      showToast('Título necessário', 'Informe o título/tópico antes de gerar com AI.', 'warning');
      return;
    }
    if (!tenant?.id) return;

    setGenerating(true);
    try {
      const result: any = await api.edgeFn('content-factory-ai', {
        action: 'generate',
        tenantId: tenant.id,
        topic: form.title.trim(),
        targetFormat: form.format,
      });

      // AI returns suggested fields — merge into form
      if (result) {
        setForm(prev => ({
          ...prev,
          description: result.description || prev.description,
          hashtags: result.hashtags || prev.hashtags,
          cta: result.cta || prev.cta,
          ai_instructions: result.ai_instructions || prev.ai_instructions,
        }));
        showToast('AI gerou conteúdo', 'Campos preenchidos com sugestão da AI. Revise antes de salvar.', 'info');
      }
    } catch (err: any) {
      showToast('Falha na geração AI', String(err.message || err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageLayout
      title="Content Factory: Editor & Builder"
      subtitle="Esteira de geração massiva governada pelo genOS Constraint Kernel."
    >
      <Section>
        <Grid>
          <Column lg={16}>
            <MatrixList onNewPost={openModal} />
          </Column>
        </Grid>
      </Section>

      {/* ─── Novo Post Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        modalHeading="Novo Post"
        primaryButtonText={saving ? 'Salvando...' : 'Criar Post'}
        secondaryButtonText="Cancelar"
        onRequestClose={() => setShowModal(false)}
        onRequestSubmit={handleSave}
        primaryButtonDisabled={saving || generating}
        size="lg"
        hasScrollingContent
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>
          {/* Formato */}
          <Select
            id="new-post-format"
            labelText="Formato"
            value={form.format}
            onChange={(e: any) => update('format', e.target.value)}
          >
            <SelectItem value="feed" text="Feed" />
            <SelectItem value="carrossel" text="Carrossel" />
            <SelectItem value="stories" text="Stories" />
            <SelectItem value="reels" text="Reels" />
          </Select>

          {/* Título */}
          <TextInput
            id="new-post-title"
            labelText="Título"
            placeholder="Ex: Lançamento coleção verão 2026"
            value={form.title}
            onChange={(e: any) => update('title', e.target.value)}
            required
          />

          {/* Descrição */}
          <TextArea
            id="new-post-description"
            labelText="Descrição / Copy"
            placeholder="Texto principal do post..."
            value={form.description}
            onChange={(e: any) => update('description', e.target.value)}
            rows={4}
          />

          {/* Data Agendada */}
          <DatePicker
            datePickerType="single"
            onChange={([date]: Date[]) => {
              if (date) {
                update('scheduled_date', date.toISOString().split('T')[0]);
              }
            }}
          >
            <DatePickerInput
              id="new-post-date"
              labelText="Data Agendada"
              placeholder="dd/mm/yyyy"
              size="md"
            />
          </DatePicker>

          {/* Hashtags */}
          <TextArea
            id="new-post-hashtags"
            labelText="Hashtags"
            placeholder="#marca #campanha #2026"
            value={form.hashtags}
            onChange={(e: any) => update('hashtags', e.target.value)}
            rows={2}
          />

          {/* CTA */}
          <TextArea
            id="new-post-cta"
            labelText="Call to Action (CTA)"
            placeholder="Ex: Acesse o link na bio e garanta o seu!"
            value={form.cta}
            onChange={(e: any) => update('cta', e.target.value)}
            rows={2}
          />

          {/* Media Slots (visible for carrossel) */}
          {form.format === 'carrossel' && (
            <NumberInput
              id="new-post-slots"
              label="Quantidade de slides (media_slots)"
              min={2}
              max={10}
              step={1}
              value={form.media_slots}
              onChange={(_: any, { value }: any) => update('media_slots', Number(value || 2))}
            />
          )}

          {/* AI Instructions */}
          <TextArea
            id="new-post-ai"
            labelText="Instruções para AI (opcional)"
            placeholder="Ex: Tom informal, usar emojis, mencionar desconto de 20%..."
            value={form.ai_instructions}
            onChange={(e: any) => update('ai_instructions', e.target.value)}
            rows={3}
          />

          {/* AI Generate Button */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={MagicWandFilled}
              onClick={handleAiGenerate}
              disabled={generating || !form.title.trim()}
            >
              {generating ? 'Gerando...' : 'Gerar com AI'}
            </Button>
            {generating && <InlineLoading description="AI processando..." />}
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
