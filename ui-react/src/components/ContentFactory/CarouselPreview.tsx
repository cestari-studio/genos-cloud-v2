// genOS Lumina — CarouselPreview: Instagram-style visual preview of card_data
import React, { useState } from 'react';
import { Image as ImageIcon } from '@carbon/icons-react';
import type { CardSlide } from './CardDataEditor';

// ─── Types ────────────────────────────────────────────────────────────────────
type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';

interface CarouselPreviewProps {
  format: PostFormat;
  cardData: CardSlide[];
  mediaMap?: Record<string, { url: string; fileName: string }>;
  /** Max width of the preview container in px */
  maxWidth?: number;
}

// ─── Aspect Ratios ────────────────────────────────────────────────────────────
const ASPECT_RATIOS: Record<PostFormat, { w: number; h: number }> = {
  feed:      { w: 1, h: 1 },
  carrossel: { w: 1, h: 1 },
  stories:   { w: 9, h: 16 },
  reels:     { w: 9, h: 16 },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CarouselPreview({
  format,
  cardData,
  mediaMap = {},
  maxWidth = 320,
}: CarouselPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const cards = cardData.length > 0 ? cardData : [];
  const aspect = ASPECT_RATIOS[format];
  const isVertical = format === 'stories' || format === 'reels';

  // Compute preview dimensions
  const previewWidth = isVertical ? Math.min(maxWidth, 200) : maxWidth;
  const previewHeight = Math.round(previewWidth * (aspect.h / aspect.w));

  if (cards.length === 0) {
    return (
      <div
        style={{
          width: previewWidth,
          height: Math.min(previewHeight, 200),
          backgroundColor: '#161616',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#525252',
          border: '1px dashed #393939',
        }}
      >
        <ImageIcon size={32} />
        <span style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Sem card_data</span>
      </div>
    );
  }

  const current = cards[activeSlide] || cards[0];
  const mediaRef = current.media_ref ? mediaMap[current.media_ref] : undefined;

  return (
    <div style={{ width: previewWidth }}>
      {/* ─── Main Preview Card ─────────────────────────────────────────── */}
      <div
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: current.background_color || '#1a1a2e',
          borderRadius: 12,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #393939',
          cursor: cards.length > 1 ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (cards.length > 1) {
            setActiveSlide(prev => (prev + 1) % cards.length);
          }
        }}
      >
        {/* Background media */}
        {mediaRef && (
          <img
            src={mediaRef.url}
            alt={mediaRef.fileName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        )}

        {/* Text overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1.5rem 1rem 1rem',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            color: current.text_color || '#ffffff',
            zIndex: 1,
          }}
        >
          {current.text_primary && (
            <p style={{
              fontWeight: 700,
              fontSize: isVertical ? '0.875rem' : '1rem',
              lineHeight: 1.3,
              marginBottom: '0.25rem',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>
              {current.text_primary}
            </p>
          )}
          {current.text_secondary && (
            <p style={{
              fontSize: isVertical ? '0.625rem' : '0.75rem',
              lineHeight: 1.4,
              opacity: 0.85,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {current.text_secondary}
            </p>
          )}
        </div>

        {/* Slide counter (top-right) */}
        {cards.length > 1 && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: '0.625rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            zIndex: 2,
          }}>
            {activeSlide + 1}/{cards.length}
          </div>
        )}

        {/* Reel duration badge */}
        {format === 'reels' && current.duration_seconds && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: '0.625rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            zIndex: 2,
          }}>
            {current.duration_seconds}s
          </div>
        )}

        {/* No-media placeholder icon */}
        {!mediaRef && !current.text_primary && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.2,
          }}>
            <ImageIcon size={48} />
          </div>
        )}
      </div>

      {/* ─── Navigation Dots ───────────────────────────────────────────── */}
      {cards.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '0.5rem',
        }}>
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              style={{
                width: i === activeSlide ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === activeSlide ? '#78a9ff' : '#525252',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0,
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ─── Thumbnail Strip (for carrossel) ───────────────────────────── */}
      {format === 'carrossel' && cards.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}>
          {cards.map((slide, i) => {
            const thumb = slide.media_ref ? mediaMap[slide.media_ref] : undefined;
            return (
              <div
                key={i}
                onClick={() => setActiveSlide(i)}
                style={{
                  flex: '0 0 48px',
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  overflow: 'hidden',
                  backgroundColor: slide.background_color || '#1a1a2e',
                  border: i === activeSlide ? '2px solid #78a9ff' : '1px solid #393939',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumb ? (
                  <img src={thumb.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '0.5rem', color: '#8d8d8d', textAlign: 'center', padding: '2px' }}>
                    {slide.text_primary?.substring(0, 12) || `S${i + 1}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
