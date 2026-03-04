// genOS Lumina — CardDataEditor: JSONB card_data editor for posts
import React, { useState } from 'react';
import {
  TextInput,
  TextArea,
  Button,
  IconButton,
  Tile,
  Stack,
  Tag,
  Layer,
} from '@carbon/react';
import {
  Add,
  TrashCan,
  ChevronUp,
  ChevronDown,
  Draggable,
  Image as ImageIcon,
} from '@carbon/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CardSlide {
  position: number;
  text_primary: string;
  text_secondary: string;
  media_ref: string | null;
  background_color?: string;
  text_color?: string;
  aspect_ratio?: string;
  duration_seconds?: number;
}

type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';

interface CardDataEditorProps {
  format: PostFormat;
  cardData: CardSlide[];
  onChange: (cards: CardSlide[]) => void;
  mediaMap?: Record<string, { url: string; fileName: string }>;
  disabled?: boolean;
}

// ─── Defaults per format ──────────────────────────────────────────────────────
const DEFAULT_SLIDE: Partial<CardSlide> = {
  text_primary: '',
  text_secondary: '',
  media_ref: null,
  background_color: '#1a1a2e',
  text_color: '#ffffff',
};

function newSlide(position: number, format: PostFormat): CardSlide {
  const base: CardSlide = {
    ...DEFAULT_SLIDE,
    position,
    text_primary: '',
    text_secondary: '',
    media_ref: null,
  };
  if (format === 'stories' || format === 'reels') {
    base.aspect_ratio = '9:16';
  }
  if (format === 'reels') {
    base.duration_seconds = 30;
  }
  return base;
}

const FORMAT_CONFIG: Record<PostFormat, { min: number; max: number; label: string }> = {
  feed: { min: 1, max: 1, label: 'Feed (1 card)' },
  carrossel: { min: 2, max: 10, label: 'Carrossel (2-10 slides)' },
  stories: { min: 1, max: 1, label: 'Story (1 card)' },
  reels: { min: 1, max: 1, label: 'Reel (1 card)' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CardDataEditor({
  format,
  cardData,
  onChange,
  mediaMap = {},
  disabled = false,
}: CardDataEditorProps) {
  const config = FORMAT_CONFIG[format];
  const cards = cardData.length > 0 ? cardData : [newSlide(1, format)];

  // ─── Card mutations ─────────────────────────────────────────────────────────
  const updateCard = (idx: number, field: keyof CardSlide, value: any) => {
    const next = cards.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
    onChange(next);
  };

  const addCard = () => {
    if (cards.length >= config.max) return;
    const next = [...cards, newSlide(cards.length + 1, format)];
    onChange(next);
  };

  const removeCard = (idx: number) => {
    if (cards.length <= config.min) return;
    const next = cards
      .filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, position: i + 1 }));
    onChange(next);
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= cards.length) return;
    const next = [...cards];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    // re-index positions
    onChange(next.map((c, i) => ({ ...c, position: i + 1 })));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Stack gap={4}>
      <Stack orientation="horizontal" gap={3}>
        <Tag type="purple" size="sm">{config.label}</Tag>
        <span className="cds--type-helper-text-01">
          {cards.length} / {config.max} slides
        </span>
        {format === 'carrossel' && cards.length < config.max && !disabled && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={addCard} hasIconOnly iconDescription="Adicionar slide" />
        )}
      </Stack>

      <Stack gap={4}>
        {cards.map((card, idx) => (
          <SlideEditor
            key={`slide-${idx}`}
            card={card}
            index={idx}
            total={cards.length}
            format={format}
            canRemove={cards.length > config.min}
            canReorder={format === 'carrossel'}
            disabled={disabled}
            mediaThumb={card.media_ref ? mediaMap[card.media_ref] : undefined}
            onUpdate={(field, value) => updateCard(idx, field, value)}
            onRemove={() => removeCard(idx)}
            onMoveUp={() => moveCard(idx, -1)}
            onMoveDown={() => moveCard(idx, 1)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

// ─── SlideEditor Sub-component ────────────────────────────────────────────────
function SlideEditor({
  card,
  index,
  total,
  format,
  canRemove,
  canReorder,
  disabled,
  mediaThumb,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  card: CardSlide;
  index: number;
  total: number;
  format: PostFormat;
  canRemove: boolean;
  canReorder: boolean;
  disabled: boolean;
  mediaThumb?: { url: string; fileName: string };
  onUpdate: (field: keyof CardSlide, value: any) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isVertical = format === 'stories' || format === 'reels';

  return (
    <Layer>
      <Tile className={index === 0 ? 'card-slide-tile card-slide-tile--primary' : 'card-slide-tile'}>
        {/* Slide header */}
        <Stack orientation="horizontal" gap={2} className="card-slide-tile__header">
          {canReorder && (
            <Draggable size={16} className="icon--info card-slide-drag-handle" />
          )}
          <span
            className="cds--type-label-01 card-slide-tile__title"
            onClick={() => setExpanded(!expanded)}
          >
            Slide {card.position}
            {card.text_primary && ` — ${card.text_primary.substring(0, 40)}${card.text_primary.length > 40 ? '...' : ''}`}
          </span>

          {/* Media thumb preview inline */}
          {mediaThumb && (
            <img
              src={mediaThumb.url}
              alt={mediaThumb.fileName}
              className="card-slide-tile__thumb"
            />
          )}

          {canReorder && (
            <>
              <IconButton kind="ghost" size="sm" label="Mover para cima" disabled={disabled || index === 0} onClick={onMoveUp}>
                <ChevronUp size={16} />
              </IconButton>
              <IconButton kind="ghost" size="sm" label="Mover para baixo" disabled={disabled || index === total - 1} onClick={onMoveDown}>
                <ChevronDown size={16} />
              </IconButton>
            </>
          )}

          {canRemove && !disabled && (
            <IconButton kind="ghost" size="sm" label="Remover slide" onClick={onRemove}>
              <TrashCan size={16} className="icon--error" />
            </IconButton>
          )}
        </Stack>

        {/* Slide fields */}
        {expanded && (
          <Stack orientation="horizontal" gap={4} className="card-slide-tile__body">
            {/* Mini preview */}
            <div
              className={`card-slide-preview ${isVertical ? 'card-slide-preview--vertical' : 'card-slide-preview--square'}`}
              style={{ backgroundColor: card.background_color || 'var(--cds-layer-03, #2d2d2d)' }}
            >
              {mediaThumb ? (
                <img
                  src={mediaThumb.url}
                  alt=""
                  className="card-slide-preview__img"
                />
              ) : (
                <ImageIcon size={20} className="icon--info" />
              )}
              <div
                className="card-slide-preview__text-overlay"
                style={{ color: card.text_color || 'var(--cds-text-primary)' }}
              >
                {card.text_primary?.substring(0, 30) || ''}
              </div>
            </div>

            {/* Form fields */}
            <Stack gap={2} className="card-slide-tile__fields">
              <TextInput
                id={`slide-${index}-primary`}
                labelText="Texto principal"
                placeholder={index === 0 ? 'Gancho / Título' : `Conteúdo do slide ${card.position}`}
                value={card.text_primary}
                onChange={(e: any) => onUpdate('text_primary', e.target.value)}
                size="sm"
                disabled={disabled}
              />
              <TextArea
                id={`slide-${index}-secondary`}
                labelText="Texto de apoio"
                placeholder="Legenda, corpo do texto..."
                value={card.text_secondary}
                onChange={(e: any) => onUpdate('text_secondary', e.target.value)}
                rows={2}
                disabled={disabled}
              />
              {format === 'reels' && (
                <TextInput
                  id={`slide-${index}-duration`}
                  labelText="Duração (segundos)"
                  type="number"
                  value={String(card.duration_seconds ?? 30)}
                  onChange={(e: any) => onUpdate('duration_seconds', Number(e.target.value) || 30)}
                  size="sm"
                  disabled={disabled}
                />
              )}
            </Stack>
          </Stack>
        )}
      </Tile>
    </Layer>
  );
}
