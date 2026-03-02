/**
 * JSX type declarations for Carbon for IBM.com custom elements (c4d-*).
 * These are Lit-based web components that React renders as native HTML elements.
 */

import type { CSSProperties, ReactNode } from 'react';

interface C4dBaseProps {
    class?: string;
    id?: string;
    style?: CSSProperties | string;
    children?: ReactNode;
    slot?: string;
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            // Card Section Carousel
            'c4d-card-section-carousel': C4dBaseProps;
            'c4d-carousel': C4dBaseProps;

            // Content section
            'c4d-content-section-heading': C4dBaseProps;
            'c4d-content-section-copy': C4dBaseProps;

            // Link with icon
            'c4d-link-with-icon': C4dBaseProps & {
                'cta-type'?: string;
                href?: string;
            };

            // Card elements
            'c4d-card': C4dBaseProps & {
                href?: string;
                'cta-type'?: string;
                'color-scheme'?: string;
            };
            'c4d-card-heading': C4dBaseProps;
            'c4d-card-eyebrow': C4dBaseProps;
            'c4d-card-cta-footer': C4dBaseProps & {
                href?: string;
                'cta-type'?: string;
            };
            'c4d-card-footer': C4dBaseProps & {
                href?: string;
                'cta-type'?: string;
            };
        }
    }
}

export { };
