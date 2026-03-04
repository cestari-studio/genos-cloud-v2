import React from 'react';
import { Stack, Tag } from '@carbon/react';
import { LogoInstagram, LogoLinkedin, UserAvatar } from '@carbon/icons-react';
import CarouselPreview from './CarouselPreview';
import type { CardSlide } from './CardDataEditor';
import '../../styles/social-preview.css';

type SocialPlatform = 'instagram' | 'linkedin';
type PostFormat = 'feed' | 'carrossel' | 'stories' | 'reels';

interface SocialMediaPreviewProps {
    platform: SocialPlatform;
    format: PostFormat;
    cardData: CardSlide[];
    mediaMap?: Record<string, { url: string; fileName: string }>;
    brandName?: string;
    brandLogo?: string;
}

export const SocialMediaPreview: React.FC<SocialMediaPreviewProps> = ({
    platform,
    format,
    cardData,
    mediaMap,
    brandName = 'Sua Marca',
    brandLogo,
}) => {
    const isInstagram = platform === 'instagram';
    const isLinkedIn = platform === 'linkedin';
    const isVertical = format === 'stories' || format === 'reels';

    // Instagram Frame
    const renderInstagramFrame = () => {
        if (isVertical) {
            return (
                <div className="social-frame ig-stories">
                    <div className="ig-stories__header">
                        <div className="ig-stories__avatar">
                            {brandLogo ? <img src={brandLogo} alt="" /> : <UserAvatar size={20} />}
                        </div>
                        <span className="ig-stories__user">{brandName}</span>
                        <span className="ig-stories__time">1h</span>
                    </div>
                    <div className="ig-stories__content">
                        <CarouselPreview format={format} cardData={cardData} mediaMap={mediaMap} maxWidth={320} />
                    </div>
                    <div className="ig-stories__footer">
                        <div className="ig-stories__message-bar">Enviar mensagem...</div>
                    </div>
                </div>
            );
        }

        return (
            <div className="social-frame ig-feed">
                <div className="ig-feed__header">
                    <div className="ig-feed__avatar">
                        {brandLogo ? <img src={brandLogo} alt="" /> : <UserAvatar size={24} />}
                    </div>
                    <div className="ig-feed__user-info">
                        <span className="ig-feed__user">{brandName}</span>
                        <span className="ig-feed__location">Patrocinado</span>
                    </div>
                </div>
                <div className="ig-feed__content">
                    <CarouselPreview format={format} cardData={cardData} mediaMap={mediaMap} maxWidth={320} />
                </div>
                <div className="ig-feed__actions">
                    <div className="ig-feed__icons">
                        <span>❤️</span> <span>💬</span> <span>✈️</span>
                        <span style={{ marginLeft: 'auto' }}>🔖</span>
                    </div>
                    <div className="ig-feed__caption">
                        <span className="ig-feed__user-bold">{brandName}</span>
                        <span className="ig-feed__text"> {cardData[0]?.text_primary?.substring(0, 100)}...</span>
                    </div>
                </div>
            </div>
        );
    };

    // LinkedIn Frame
    const renderLinkedInFrame = () => {
        return (
            <div className="social-frame li-feed">
                <div className="li-feed__header">
                    <div className="li-feed__avatar">
                        {brandLogo ? <img src={brandLogo} alt="" /> : <UserAvatar size={48} />}
                    </div>
                    <div className="li-feed__user-info">
                        <span className="li-feed__user">{brandName}</span>
                        <span className="li-feed__desc">Empresa • Tecnologia</span>
                        <span className="li-feed__time">Promovido • 🌐</span>
                    </div>
                </div>
                <div className="li-feed__caption">
                    {cardData[0]?.text_primary}
                </div>
                <div className="li-feed__content">
                    <CarouselPreview format={format} cardData={cardData} mediaMap={mediaMap} maxWidth={320} />
                </div>
                <div className="li-feed__actions">
                    <div className="li-feed__stats">
                        <span>👍❤️😊 124</span>
                        <span>• 12 comentários</span>
                    </div>
                    <div className="li-feed__buttons">
                        <span>Like</span> <span>Comment</span> <span>Repost</span> <span>Send</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="social-preview-wrapper">
            <Stack gap={4}>
                <div className="social-preview-selector">
                    <Tag
                        type={isInstagram ? 'magenta' : 'gray'}
                        renderIcon={LogoInstagram}
                        onClick={() => { }}
                        style={{ cursor: 'pointer' }}
                    >
                        Instagram
                    </Tag>
                    <Tag
                        type={isLinkedIn ? 'blue' : 'gray'}
                        renderIcon={LogoLinkedin}
                        onClick={() => { }}
                        style={{ cursor: 'pointer' }}
                    >
                        LinkedIn
                    </Tag>
                </div>

                <div className="social-preview-container">
                    {isInstagram ? renderInstagramFrame() : renderLinkedInFrame()}
                </div>
            </Stack>
        </div>
    );
};
