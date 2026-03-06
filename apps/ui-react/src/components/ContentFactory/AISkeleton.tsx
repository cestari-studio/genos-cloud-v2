import React from 'react';
import { SkeletonText, SkeletonPlaceholder } from '@carbon/react';

interface AISkeletonProps {
    type?: 'text' | 'placeholder';
    lines?: number;
    className?: string;
}

/**
 * genOS™ v5.0.0 - AISkeleton™ Component
 * Follows IBM Carbon GS100 design for AI loading states.
 */
export const AISkeleton: React.FC<AISkeletonProps> = ({ type = 'text', lines = 3, className }) => {
    if (type === 'placeholder') {
        return (
            <div className={`ai-skeleton-container ${className || ''}`}>
                <SkeletonPlaceholder className="ai-glow-pulse" style={{ width: '100%', height: '200px' }} />
            </div>
        );
    }

    return (
        <div className={`ai-skeleton-container ${className || ''}`}>
            {[...Array(lines)].map((_, i) => (
                <SkeletonText key={i} className="ai-glow-pulse" width={`${Math.floor(Math.random() * 40) + 60}%`} />
            ))}
        </div>
    );
};

export default AISkeleton;
