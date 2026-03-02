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
import { t } from '../components/LocaleSelectorModal';

import type { CardSlide } from '../components/ContentFactory/CardDataEditor';
import CardDataEditor from '../components/ContentFactory/CardDataEditor';

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
  card_data: CardSlide[];
}

function defaultCardData(format: PostFormat, slots: number): CardSlide[] {
  if (format === 'carrossel') {
    return Array.from({ length: slots }, (_, i) => ({
      position: i + 1,
      text_primary: '',
      text_secondary: '',
      media_ref: null,
    }));
  }
  const base: CardSlide = { position: 1, text_primary: '', text_secondary: '', media_ref: null };
  if (format === 'stories') return [{ ...base, aspect_ratio: '9:16' }];
  if (format === 'reels') return [{ ...base, aspect_ratio: '9:16', duration_seconds: 30 }];
  return [{ ...base, background_color: '#1a1a2e', text_color: '#ffffff' }];
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
  card_data: defaultCardData('feed', 1),
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
      // Auto-adjust media_slots and card_data when format changes
      if (field === 'format') {
        const newFormat = value as PostFormat;
        next.media_slots = MEDIA_SLOTS_BY_FORMAT[newFormat] || 1;
        next.card_data = defaultCardData(newFormat, next.media_slots);
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
      showToast(t('factoryTitleRequired'), t('factoryTitleRequiredMsg'), 'warning');
      return;
    }
    if (!tenant?.id) {
      showToast(t('factoryNoTenant'), t('factoryNoTenantMsg'), 'error');
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
        card_data: form.card_data,
        media_slots: form.media_slots,
        ai_instructions: form.ai_instructions.trim() || null,
      });

      if (error) throw error;

      showToast(t('factoryPostCreated'), `"${form.title}" ${t('factoryPostAddedDraft')}`, 'success');
      setShowModal(false);
    } catch (err: any) {
      showToast(t('factoryCreationError'), String(err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!form.title.trim()) {
      showToast(t('factoryTitleNeeded'), t('factoryTitleBeforeAi'), 'warning');
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
          card_data: result.card_data?.length ? result.card_data : prev.card_data,
        }));
        showToast(t('factoryAiGenerated'), t('factoryAiSuggestion'), 'info');
      }
    } catch (err: any) {
      showToast(t('factoryAiFailed'), String(err.message || err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageLayout
      pageSubtitle="genOS - Content Factory"
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
        modalHeading={t('factoryNewPost')}
        primaryButtonText={saving ? t('factoryCreatingPost') : t('factoryCreateButton')}
        secondaryButtonText={t('factoryCancelButton')}
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
            labelText={t('factoryFormat')}
            value={form.format}
            onChange={(e: any) => update('format', e.target.value)}
          >
            <SelectItem value="feed" text={t('matrixFeed')} />
            <SelectItem value="carrossel" text={t('matrixCarousel')} />
            <SelectItem value="stories" text={t('matrixStories')} />
            <SelectItem value="reels" text={t('matrixReels')} />
          </Select>

          {/* Título */}
          <TextInput
            id="new-post-title"
            labelText={t('factoryTitle_Input')}
            placeholder="Ex: Lançamento coleção verão 2026"
            value={form.title}
            onChange={(e: any) => update('title', e.target.value)}
            required
          />

          {/* Descrição */}
          <TextArea
            id="new-post-description"
            labelText={t('factoryDescription')}
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
              labelText={t('factoryScheduledDate')}
              placeholder="dd/mm/yyyy"
              size="md"
            />
          </DatePicker>

          {/* Hashtags */}
          <TextArea
            id="new-post-hashtags"
            labelText={t('factoryHashtags')}
            placeholder="#marca #campanha #2026"
            value={form.hashtags}
            onChange={(e: any) => update('hashtags', e.target.value)}
            rows={2}
          />

          {/* CTA */}
          <TextArea
            id="new-post-cta"
            labelText={t('factoryCTA')}
            placeholder="Ex: Acesse o link na bio e garanta o seu!"
            value={form.cta}
            onChange={(e: any) => update('cta', e.target.value)}
            rows={2}
          />

          {/* Media Slots (visible for carrossel) */}
          {form.format === 'carrossel' && (
            <NumberInput
              id="new-post-slots"
              label={t('factoryMediaSlots')}
              min={2}
              max={10}
              step={1}
              value={form.media_slots}
              onChange={(_: any, { value }: any) => update('media_slots', Number(value || 2))}
            />
          )}

          {/* Card Data Editor */}
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#c6c6c6', marginBottom: '0.5rem' }}>
              {t('factoryCardData')}
            </p>
            <CardDataEditor
              format={form.format}
              cardData={form.card_data}
              onChange={(cards) => update('card_data', cards)}
            />
          </div>

          {/* AI Instructions */}
          <TextArea
            id="new-post-ai"
            labelText={t('factoryAiInstructions')}
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
              {generating ? t('factoryGenerating') : t('factoryGenerateAi')}
            </Button>
            {generating && <InlineLoading description={t('factoryAiProcessing')} />}
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
