import { useState, useCallback } from 'react';
import { useKernelQuery } from '@/hooks/use-kernel-query';
import { useAuth } from '@/hooks/use-auth';
import { graph } from '@/lib/api-client';

interface FriendButtonProps {
    targetUserId: string;
}

type FriendState = 'none' | 'pending' | 'friend';

export function FriendButton({ targetUserId }: FriendButtonProps) {
    const { user } = useAuth();
    const [acting, setActing] = useState(false);

    const { data: friendState, refetch } = useKernelQuery<FriendState>({
        queryFn: useCallback(async () => {
            if (!user) return 'none';
            const result = await graph.batchCheck([targetUserId], 'friend');
            if (result[targetUserId]) return 'friend';
            const pendingResult = await graph.batchCheck([targetUserId], 'friend_request');
            if (pendingResult[targetUserId]) return 'pending';
            return 'none';
        }, [user, targetUserId]),
        enabled: !!user,
    });

    async function handleClick() {
        if (!user || acting) return;
        setActing(true);
        try {
            if (friendState === 'friend') {
                await graph.unlink(targetUserId, 'friend');
            } else if (friendState === 'pending') {
                await graph.unlink(targetUserId, 'friend_request');
            } else {
                await graph.link(targetUserId, 'friend_request');
            }
            await refetch();
        } finally {
            setActing(false);
        }
    }

    const labels: Record<FriendState, string> = {
        none: 'Add Friend',
        pending: 'Request Sent',
        friend: 'Friends',
    };

    const state = friendState ?? 'none';

    return (
        <button
            onClick={handleClick}
            disabled={acting}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                state === 'friend'
                    ? 'border-koa-300 text-koa-700 hover:bg-lehua-50 hover:text-lehua-700 hover:border-lehua-300'
                    : state === 'pending'
                      ? 'border-koa-300 text-koa-500 bg-koa-50'
                      : 'border-kai-300 text-kai-700 hover:bg-kai-50'
            }`}
        >
            {acting ? '...' : labels[state]}
        </button>
    );
}
