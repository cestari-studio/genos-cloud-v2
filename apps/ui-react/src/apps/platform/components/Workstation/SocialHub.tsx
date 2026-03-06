import React, { useEffect, useState } from 'react';
import {
    Loading,
    Tag,
    Button,
    ContentSwitcher,
    Switch,
    Tile,
} from '@carbon/react';
import {
    Calendar as CalendarIcon,
    List as ListIcon,
    CheckmarkOutline,
    Time,
    WarningAlt,
    Send
} from '@carbon/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/services/supabase';

interface SocialQueueItem {
    id: string;
    asset_id: string;
    platform: 'linkedin' | 'instagram' | 'twitter' | string;
    scheduled_for: string;
    status: 'scheduled' | 'publishing' | 'published' | 'failed';
    matrix_assets: {
        title: string;
        content: string;
    };
    external_post_url?: string;
    error_log?: string;
}

export default function SocialHub({ tenantId }: { tenantId?: string }) {
    const { t } = useTranslation('workstation');
    const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
    const [queue, setQueue] = useState<SocialQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState<string | null>(null);

    const fetchQueue = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('social_posts_queue')
                .select(`
                    id, asset_id, platform, scheduled_for, status, external_post_url, error_log,
                    matrix_assets (title, content)
                `)
                .order('scheduled_for', { ascending: true });

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setQueue(data as unknown as SocialQueueItem[]);
        } catch (err) {
            console.error('Failed to fetch social queue:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();

        // Setup realtime
        const channel = supabase.channel('social_queue_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts_queue' }, () => {
                fetchQueue();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'scheduled': return <Time size={16} />;
            case 'publishing': return <Loading withOverlay={false} small />;
            case 'published': return <CheckmarkOutline size={16} style={{ color: '#24a148' }} />;
            case 'failed': return <WarningAlt size={16} style={{ color: '#da1e28' }} />;
            default: return null;
        }
    };

    const handleForcePublish = async (id: string) => {
        setIsPublishing(id);
        try {
            const { error } = await supabase.functions.invoke('social-publisher', {
                body: { queue_ids: [id] }
            });
            if (error) throw error;
        } catch (err) {
            console.error('Failed to force publish', err);
            // Optionally show a toast here
        } finally {
            setIsPublishing(null);
            fetchQueue();
        }
    };

    if (isLoading) {
        return <div style={{ padding: '3rem', textAlign: 'center' }}><Loading withOverlay={false} /></div>;
    }

    return (
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--cds-background)', color: 'var(--cds-text-primary)', minHeight: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 className="cds--type-heading-04" style={{ marginBottom: '0.5rem' }}>Social Hub</h2>
                    <p className="cds--type-body-short-02" style={{ color: 'var(--cds-text-secondary)' }}>
                        GenOS Auto-Scheduler & Distribution Matrix
                    </p>
                </div>
                <ContentSwitcher
                    selectedIndex={viewMode === 'timeline' ? 0 : 1}
                    onChange={(e: any) => setViewMode(e.name)}
                    style={{ width: '300px' }}
                    size="md"
                >
                    <Switch name="timeline" text="Timeline" />
                    <Switch name="calendar" text="Calendar" disabled />
                </ContentSwitcher>
            </div>

            {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--cds-text-helper)', border: '1px dashed var(--cds-border-subtle-01)' }}>
                    <p className="cds--type-body-long-02">Queue is empty. Generate and approve assets to schedule them.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <AnimatePresence>
                        {queue.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Tile style={{
                                    backgroundColor: 'var(--cds-layer-01)',
                                    borderLeft: `4px solid ${item.status === 'published' ? 'var(--cds-support-success)' : item.status === 'failed' ? 'var(--cds-support-error)' : 'var(--cds-interactive)'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                <Tag type={item.platform === 'linkedin' ? 'blue' : item.platform === 'instagram' ? 'magenta' : 'cyan'}>
                                                    {item.platform.toUpperCase()}
                                                </Tag>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                                                    {getStatusIcon(item.status)}
                                                    {item.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <h4 className="cds--type-heading-02" style={{ marginBottom: '0.5rem' }}>
                                                {item.matrix_assets?.title || 'Untitled Asset'}
                                            </h4>
                                            <div
                                                style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            >
                                                {item.matrix_assets?.content}
                                            </div>

                                            {item.error_log && (
                                                <div style={{ marginTop: '0.5rem', color: 'var(--cds-support-error)', fontSize: '0.75rem' }}>
                                                    <strong>Error:</strong> {item.error_log}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                                            <div style={{ color: 'var(--cds-text-secondary)', fontSize: '0.875rem' }}>
                                                Scheduled for: <br />
                                                <strong style={{ color: 'var(--cds-text-primary)' }}>{new Date(item.scheduled_for).toLocaleString()}</strong>
                                            </div>

                                            {item.status === 'scheduled' && (
                                                <Button
                                                    kind="tertiary"
                                                    size="sm"
                                                    renderIcon={Send}
                                                    onClick={() => handleForcePublish(item.id)}
                                                    disabled={isPublishing === item.id}
                                                >
                                                    Publish Now
                                                </Button>
                                            )}

                                            {item.status === 'published' && item.external_post_url && (
                                                <Button
                                                    kind="ghost"
                                                    size="sm"
                                                    href={item.external_post_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    View Post
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Tile>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
