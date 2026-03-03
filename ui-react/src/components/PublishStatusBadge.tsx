import React, { useEffect, useState } from 'react';
import { Stack, Tooltip } from '@carbon/react';
import { LogoInstagram, LogoFacebook, CheckmarkFilled, WarningFilled, Pending } from '@carbon/icons-react';
import { supabase } from '../services/supabase';

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

    const renderIcon = (status: string) => {
        if (status === 'published') return <CheckmarkFilled size={12} fill="#24a148" />;
        if (status === 'failed') return <WarningFilled size={12} fill="#da1e28" />;
        return <Pending size={12} fill="#0f62fe" />;
    };

    return (
        <Stack orientation="horizontal" gap={2}>
            {statuses.map((s, idx) => (
                <Tooltip key={idx} label={`${s.platform}: ${s.status}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'help' }}>
                        {s.platform === 'instagram' ? <LogoInstagram size={14} /> : <LogoFacebook size={14} />}
                        {renderIcon(s.status)}
                    </div>
                </Tooltip>
            ))}
        </Stack>
    );
}
