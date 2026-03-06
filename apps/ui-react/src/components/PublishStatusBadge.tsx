import React, { useEffect, useState } from 'react';
import { Stack, Tooltip } from '@carbon/react';
import { LogoInstagram, LogoFacebook, CheckmarkFilled, WarningFilled, Pending } from '@carbon/icons-react';
import { supabase } from '@/services/supabase';

interface PublishStatusBadgeProps {
    postId: string;
}

export default function PublishStatusBadge({ postId }: PublishStatusBadgeProps) {
    const [statuses, setStatuses] = useState<any[]>([]);

    useEffect(() => {
        // Static fetch only — no realtime subscription to avoid per-row Supabase channels
        // that caused automatic re-renders across the whole table.
        const fetchStatus = async () => {
            const { data } = await supabase
                .from('publish_queue')
                .select('platform, status, external_post_id')
                .eq('post_id', postId);
            setStatuses(data || []);
        };
        fetchStatus();
    }, [postId]);

    if (statuses.length === 0) return null;

    const renderStatusIcon = (status: string) => {
        if (status === 'published') return <CheckmarkFilled size={12} className="icon--success" />;
        if (status === 'failed') return <WarningFilled size={12} className="icon--error" />;
        return <Pending size={12} className="icon--info" />;
    };

    return (
        <Stack orientation="horizontal" gap={2}>
            {statuses.map((s, idx) => (
                <Tooltip key={idx} label={`${s.platform}: ${s.status}`}>
                    <Stack orientation="horizontal" gap={1} className="publish-status-icon">
                        {s.platform === 'instagram' ? <LogoInstagram size={14} /> : <LogoFacebook size={14} />}
                        {renderStatusIcon(s.status)}
                    </Stack>
                </Tooltip>
            ))}
        </Stack>
    );
}
