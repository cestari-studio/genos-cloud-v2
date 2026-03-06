import { SkeletonText, SkeletonPlaceholder, Grid, Column } from '@carbon/react';

/**
 * PageSkeleton — shown via React Suspense while lazy pages are loading.
 * Mimics the PageLayout structure: a header + content area.
 */
export default function PageSkeleton() {
    return (
        <div className="page-skeleton" aria-busy="true" aria-live="polite">
            {/* Fake page header */}
            <div className="page-skeleton__header">
                <div className="page-skeleton__header-text">
                    <SkeletonText heading width="28%" />
                    <SkeletonText width="42%" />
                </div>
                <SkeletonPlaceholder className="page-skeleton__action" />
            </div>

            {/* Fake content body */}
            <div className="page-skeleton__content">
                <Grid fullWidth>
                    {/* Row of placeholder tiles */}
                    {[0, 1, 2].map(i => (
                        <Column key={i} sm={4} md={4} lg={5}>
                            <SkeletonPlaceholder className="page-skeleton__tile" />
                        </Column>
                    ))}

                    {/* Big table placeholder */}
                    <Column sm={4} md={8} lg={16}>
                        <div className="page-skeleton__table-header">
                            <SkeletonText heading width="22%" />
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <SkeletonText key={i} width={`${70 + (i % 3) * 10}%`} />
                        ))}
                    </Column>
                </Grid>
            </div>
        </div>
    );
}
