// genOS Lumina — Content Factory page (unified for all depth levels)
import { useState } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SelectItem,
  NumberInput,
  InlineLoading,
} from '@carbon/react';
import { MagicWandFilled } from '@carbon/icons-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MatrixList from '../../components/ContentFactory/MatrixList';
import { useNotifications } from '../../components/NotificationProvider';
import '../../styles/content-factory.css';

type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';

interface NewPostForm {
  format: PostFormat;
  topic: string;
  cardCount: number;
}

const EMPTY_FORM: NewPostForm = {
  format: 'feed',
  topic: '',
  cardCount: 1,
};

export default function ContentFactory() {
  const { showToast } = useNotifications();
  const { me: { tenant } } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewPostForm>({ ...EMPTY_FORM });
  const [generating, setGenerating] = useState(false);

  const update = (field: keyof NewPostForm, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Reset cardCount to appropriate default when format changes
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

  /* ─── AI generates the full post from just topic + format + cardCount ─── */
  const handleGenerate = async () => {
    if (!form.topic.trim()) {
      showToast('Tema obrigatório', 'Informe o tema principal do post.', 'warning');
      return;
    }
    if (!tenant?.id) {
      showToast('Sem tenant', 'Selecione um workspace ativo.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const result: any = await api.edgeFn('content-factory-ai', {
        action: 'generate',
        tenantId: tenant.id,
        topic: form.topic.trim(),
        targetFormat: form.format,
        cardCount: form.format === 'carrossel' ? form.cardCount : 1,
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
      setShowModal(false);
    } catch (err: any) {
      showToast('Erro ao gerar post', String(err.message || err), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="content-factory-page" style={{ height: 'calc(100vh - 48px)', overflow: 'auto', padding: 'var(--cds-spacing-06)' }}>
      <MatrixList onNewPost={openModal} />

      {/* ─── Novo Post Modal (simplified — AI does the heavy lifting) ──── */}
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

          {generating && (
            <InlineLoading
              description="AI gerando post completo com base no DNA da marca..."
              status="active"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
