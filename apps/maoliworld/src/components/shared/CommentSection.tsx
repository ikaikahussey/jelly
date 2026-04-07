import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, type KernelObject } from '@/lib/api-client';
import { TimeAgo } from '@/components/shared/TimeAgo';
import { LoadMore } from '@/components/shared/LoadMore';

interface CommentSectionProps {
    parentId: string;
}

export function CommentSection({ parentId }: CommentSectionProps) {
    const { user } = useAuth();
    const [commentBody, setCommentBody] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const queryFn = useCallback(
        (cursor?: string) =>
            objects
                .query({ type: 'comment', parent: parentId, visibility: 'public', limit: 20, cursor })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        [parentId]
    );

    const { items, loading, loadingMore, hasMore, loadMore, refetch } =
        usePaginatedQuery<KernelObject>({ queryFn });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!commentBody.trim()) return;
        setSubmitting(true);
        try {
            await objects.create({
                type: 'comment',
                payload: { body: commentBody.trim() },
                visibility: 'public',
                parent_id: parentId,
            });
            setCommentBody('');
            await refetch();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-koa-700">
                Comments {items.length > 0 && `(${items.length})`}
            </h3>

            {user && (
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300"
                    />
                    <button
                        type="submit"
                        disabled={submitting || !commentBody.trim()}
                        className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? '...' : 'Post'}
                    </button>
                </form>
            )}

            {loading ? (
                <div className="animate-pulse space-y-2">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="h-12 bg-koa-100 rounded" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-koa-400 text-sm">No comments yet.</p>
            ) : (
                <>
                    <div className="space-y-3">
                        {items.map(comment => (
                            <CommentCard key={comment.object_id} comment={comment} />
                        ))}
                    </div>
                    <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                </>
            )}
        </div>
    );
}

function CommentCard({ comment }: { comment: KernelObject }) {
    const body = (comment.payload.body as string) ?? '';

    return (
        <div className="bg-white rounded-lg border border-koa-100 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-koa-500">{comment.owner_id.slice(0, 8)}</span>
                <TimeAgo timestamp={comment.created_at} className="text-xs" />
            </div>
            <p className="text-sm text-gray-700">{body}</p>
        </div>
    );
}
