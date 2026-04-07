import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, type KernelObject } from '@/lib/api-client';
import { TimeAgo } from '@/components/shared/TimeAgo';
import { LoadMore } from '@/components/shared/LoadMore';
import { NewForumPost } from '@/components/forum/NewForumPost';

export function ForumsPage() {
    const { user } = useAuth();
    const [showNew, setShowNew] = useState(false);

    const queryFn = useCallback(
        (cursor?: string) =>
            objects
                .query({ type: 'forum_post', visibility: 'public', limit: 20, cursor })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        []
    );

    const { items, loading, loadingMore, hasMore, loadMore, refetch } =
        usePaginatedQuery<KernelObject>({ queryFn });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-koa-900">Discussion Forums</h1>
                {user && (
                    <button
                        onClick={() => setShowNew(!showNew)}
                        className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 transition-colors"
                    >
                        New Discussion
                    </button>
                )}
            </div>

            {showNew && (
                <NewForumPost
                    onCreated={() => {
                        setShowNew(false);
                        void refetch();
                    }}
                    onCancel={() => setShowNew(false)}
                />
            )}

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="bg-white rounded-lg border border-koa-200 p-4 animate-pulse h-20" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-koa-400 text-center py-12">No discussions yet. Start one!</p>
            ) : (
                <>
                    <div className="bg-white rounded-lg border border-koa-200 divide-y divide-koa-100">
                        {items.map(post => (
                            <ForumRow key={post.object_id} post={post} />
                        ))}
                    </div>
                    <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                </>
            )}
        </div>
    );
}

function ForumRow({ post }: { post: KernelObject }) {
    const title = (post.payload.title as string) ?? 'Untitled';

    return (
        <Link
            to={`/forums/${post.object_id}`}
            className="block px-4 py-3 hover:bg-koa-50 transition-colors"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{title}</h3>
                <TimeAgo timestamp={post.created_at} className="text-xs flex-shrink-0 ml-4" />
            </div>
        </Link>
    );
}
