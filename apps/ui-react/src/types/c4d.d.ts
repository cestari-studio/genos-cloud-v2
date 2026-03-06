/**
 * JSX type declarations for Carbon for IBM.com custom elements (c4d-*).
 * These are Lit-based web components that React renders as native HTML elements.
 */

import type { CSSProperties, ReactNode } from 'react';

interface C4dBaseProps {
    class?: string;
    className?: string; // allow React's className
    id?: string;
    style?: CSSProperties | string;
    children?: ReactNode;
    slot?: string;
    onClick?: React.MouseEventHandler<any>;
    href?: string;
    key?: React.Key;
    [key: string]: any; // fallback for other custom attributes
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
            'c4d-card-copy': C4dBaseProps;
            'c4d-card-cta-footer': C4dBaseProps;
            'c4d-card-footer': C4dBaseProps;

            // Leadspace
            'c4d-leadspace': C4dBaseProps & {
                'size'?: string;
                'gradient'?: boolean;
            };
            'c4d-leadspace-heading': C4dBaseProps;
            'c4d-leadspace-copy': C4dBaseProps;
            'c4d-leadspace-cta': C4dBaseProps;

            // Pricing Table
            'c4d-pricing-table': C4dBaseProps & {
                'highlight-column'?: number;
                'highlight-label'?: string;
            };
            'c4d-pricing-table-header': C4dBaseProps;
            'c4d-pricing-table-row': C4dBaseProps;
            'c4d-pricing-table-cell': C4dBaseProps;
            'c4d-pricing-table-header-cell': C4dBaseProps;
            'c4d-pricing-table-footer': C4dBaseProps;

            // Masthead & Footer
            'c4d-masthead-container': C4dBaseProps;
            'c4d-footer-container': C4dBaseProps;
        }
    }
}

export { };
