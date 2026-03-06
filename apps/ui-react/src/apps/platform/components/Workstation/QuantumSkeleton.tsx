import React from 'react';
import { SkeletonPlaceholder, Section, Heading } from '@carbon/react';

export const QuantumSkeleton = () => {
    return (
        <div style={{ padding: '2rem', background: 'var(--cds-background)', minHeight: '100vh', color: 'var(--cds-text-primary)' }}>
            <Section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <SkeletonPlaceholder style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                    <Heading>
                        <SkeletonPlaceholder style={{ width: '300px', height: '32px' }} />
                    </Heading>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <SkeletonPlaceholder style={{ width: '100%', height: '400px', borderRadius: '4px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <SkeletonPlaceholder style={{ width: '100%', height: '150px' }} />
                            <SkeletonPlaceholder style={{ width: '100%', height: '150px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <SkeletonPlaceholder style={{ width: '100%', height: '100px' }} />
                        <SkeletonPlaceholder style={{ width: '100%', height: '200px' }} />
                        <SkeletonPlaceholder style={{ width: '100%', height: '150px' }} />
                    </div>
                </div>
            </Section>
        </div>
    );
};
