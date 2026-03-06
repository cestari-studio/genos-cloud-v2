import React, { ReactNode } from 'react';
import { Theme } from '@carbon/react';
import '@carbon/ibmdotcom-web-components/es/components/masthead/index.js';
import '@carbon/ibmdotcom-web-components/es/components/footer/index.js';

interface MarketingLayoutProps {
    children: ReactNode;
}

const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
    return (
        <Theme theme="g100">
            <div className="marketing-layout" style={{ backgroundColor: '#161616', minHeight: '100vh', color: '#f4f4f4' }}>
                {/* @ts-ignore */}
                <c4d-masthead-container></c4d-masthead-container>

                <main id="main-content" style={{ paddingTop: '3rem' }}>
                    {children}
                </main>

                {/* @ts-ignore */}
                <c4d-footer-container size="short"></c4d-footer-container>
            </div>
        </Theme>
    );
};

export default MarketingLayout;
