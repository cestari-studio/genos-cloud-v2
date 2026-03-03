// genOS Lumina — Content Factory page (unified for all depth levels)
import { useState, useRef } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
  InlineLoading,
  RadioButtonGroup,
  RadioButton,
  DatePicker,
  DatePickerInput,
} from '@carbon/react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MatrixList from '../../components/ContentFactory/MatrixList';
import PageLayout from '../../components/PageLayout';
import { useNotifications } from '../../components/NotificationProvider';
import '../../styles/content-factory.css';

type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';
type DateMode = 'ai' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'custom';

interface NewPostForm {
  format: PostFormat;
  topic: string;
  cardCount: number;
  dateMode: DateMode;
  customDate: string | null;
}

const EMPTY_FORM: NewPostForm = {
  format: 'feed',
  topic: '',
  cardCount: 1,
  dateMode: 'ai',
  customDate: null,
};

/** Returns an ISO date based on the quick-pick option */
function resolveScheduledDate(mode: DateMode, customDate: string | null): string | null {
  const now = new Date();
  const startOfDay = (d: Date) => { d.setHours(9, 0, 0, 0); return d; };
  switch (mode) {
    case 'ai': return null; // let the AI or backend decide
    case 'today': return startOfDay(new Date(now)).toISOString();
    case 'tomorrow': {
      const d = new Date(now); d.setDate(d.getDate() + 1);
      return startOfDay(d).toISOString();
    }
    case 'this_week': {
      // Next weekday that isn't today
      const d = new Date(now); d.setDate(d.getDate() + 2);
      return startOfDay(d).toISOString();
    }
    case 'next_week': {
      const d = new Date(now);
      const dayOfWeek = d.getDay(); // 0=Sun
      const daysUntilNextMon = (7 - dayOfWeek + 1) % 7 || 7;
      d.setDate(d.getDate() + daysUntilNextMon);
      return startOfDay(d).toISOString();
    }
    case 'custom': return customDate;
    default: return null;
  }
}

export default function ContentFactory() {
  const { showToast } = useNotifications();
  const { me: { tenant }, refreshWallet } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPostForm>({ ...EMPTY_FORM });
  const [generating, setGenerating] = useState(false);
  const [postCount, setPostCount] = useState<number | undefined>(undefined);
  const refreshRef = useRef<(() => void) | null>(null);

  const update = <K extends keyof NewPostForm>(field: K, value: NewPostForm[K]) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'format') {
        const fmt = value as PostFormat;
        next.cardCount = fmt === 'carrossel' ? 5 : 1;
      }
      return next;
    });
  };

  const openModal = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  /* ─── AI generates the full post from topic + format + cardCount + date ─── */
  const handleGenerate = async () => {
    if (!form.topic.trim()) {
      showToast('Tema obrigatório', 'Informe o tema principal do post.', 'warning');
      return;
    }
    if (!tenant?.id) {
      showToast('Sem tenant', 'Selecione um workspace ativo.', 'error');
      return;
    }

    const scheduledDate = resolveScheduledDate(form.dateMode, form.customDate);

    setGenerating(true);
    try {
      const result: any = await api.edgeFn('content-factory-ai', {
        action: 'generate',
        tenantId: tenant.id,
        topic: form.topic.trim(),
        targetFormat: form.format,
        cardCount: form.format === 'carrossel' ? form.cardCount : 1,
        ...(scheduledDate ? { scheduled_date: scheduledDate } : {}),
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Falha na geração');
      }

      const ai = result.data || {};
      showToast(
        'Post criado com AI',
        `"${ai.title || form.topic}" gerado e salvo como pendente de revisão.`,
        'success',
      );
      // Refresh usage stats via explicit DB query to immediately resync the top badge
      refreshWallet();
      setShowModal(false);
      // Trigger table refresh immediately
      setTimeout(() => refreshRef.current?.(), 500);
    } catch (err: any) {
      showToast('Erro ao gerar post', String(err.message || err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageLayout
      pageName="Content Factory"
      pageDescription="Crie, gerencie e publique conteúdo com IA — do texto às hashtags."
      itemCount={postCount}
    >
      <div className="content-factory-page">
        <MatrixList
          onNewPost={openModal}
          onRefreshRef={refreshRef}
          onCountChange={setPostCount}
        />

        {/* ─── Novo Post Modal ──────────────────────────────────────────── */}
        <Modal
          open={showModal}
          modalHeading="Novo Post"
          primaryButtonText={generating ? 'Gerando...' : 'Gerar com AI'}
          secondaryButtonText="Cancelar"
          onRequestClose={() => !generating && setShowModal(false)}
          onRequestSubmit={handleGenerate}
          primaryButtonDisabled={generating || !form.topic.trim()}
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#a8a8a8', margin: 0 }}>
              Defina o formato, tema e quantidade de cards. A IA cria tudo com base no DNA da marca.
            </p>

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

            {form.format === 'carrossel' && (
              <NumberInput
                id="new-post-card-count"
                label="Quantidade de cards"
                min={2}
                max={10}
                step={1}
                value={form.cardCount}
                onChange={(_: any, { value }: any) => update('cardCount', Number(value || 5))}
              />
            )}

            <TextInput
              id="new-post-topic"
              labelText="Tema principal"
              placeholder="Ex: Lançamento coleção verão 2026"
              value={form.topic}
              onChange={(e: any) => update('topic', e.target.value)}
              required
            />

            {/* ─── Data de postagem ─────────────────────────────────────── */}
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c6c6c6', marginBottom: '0.5rem' }}>
                DATA DE POSTAGEM
              </p>
              <RadioButtonGroup
                name="date-mode"
                valueSelected={form.dateMode}
                onChange={(val: string | number | undefined) => update('dateMode', (val ?? 'ai') as DateMode)}
                orientation="vertical"
              >
                <RadioButton id="date-ai" value="ai" labelText="Deixar IA sugerir" />
                <RadioButton id="date-today" value="today" labelText="Hoje" />
                <RadioButton id="date-tomorrow" value="tomorrow" labelText="Amanhã" />
                <RadioButton id="date-this-week" value="this_week" labelText="Essa semana" />
                <RadioButton id="date-next-week" value="next_week" labelText="Semana que vem" />
                <RadioButton id="date-custom" value="custom" labelText="Data específica" />
              </RadioButtonGroup>

              {form.dateMode === 'custom' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <DatePicker
                    datePickerType="single"
                    dateFormat="d/m/Y"
                    onChange={(dates: Date[]) => {
                      if (dates[0]) update('customDate', dates[0].toISOString());
                    }}
                  >
                    <DatePickerInput
                      id="new-post-custom-date"
                      labelText="Selecione a data"
                      placeholder="dd/mm/aaaa"
                      size="md"
                    />
                  </DatePicker>
                </div>
              )}
            </div>

            {generating && (
              <InlineLoading
                description="AI gerando post completo com base no DNA da marca..."
                status="active"
              />
            )}
          </div>
        </Modal>
      </div>
    </PageLayout>
  );
}
