import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, type KernelObject } from '@/lib/api-client';
import { TimeAgo } from '@/components/shared/TimeAgo';
import { LoadMore } from '@/components/shared/LoadMore';
import { NewBlogPost } from '@/components/blog/NewBlogPost';

export function BlogsPage() {
    const { user } = useAuth();
    const [showNew, setShowNew] = useState(false);

    const queryFn = useCallback(
        (cursor?: string) =>
            objects
                .query({ type: 'blog_post', visibility: 'public', limit: 10, cursor })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        []
    );

    const { items, loading, loadingMore, hasMore, loadMore, refetch } =
        usePaginatedQuery<KernelObject>({ queryFn });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-koa-900">Member Blogs</h1>
                {user && (
                    <button
                        onClick={() => setShowNew(!showNew)}
                        className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 transition-colors"
                    >
                        Write a Post
                    </button>
                )}
            </div>

            {showNew && (
                <NewBlogPost
                    onCreated={() => {
                        setShowNew(false);
                        void refetch();
                    }}
                    onCancel={() => setShowNew(false)}
                />
            )}

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }, (_, i) => (
                        <div key={i} className="bg-white rounded-lg border border-koa-200 p-6 animate-pulse h-40" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-koa-400 text-center py-12">No blog posts yet. Write the first one!</p>
            ) : (
                <>
                    <div className="space-y-4">
                        {items.map(post => (
                            <BlogCard key={post.object_id} post={post} />
                        ))}
                    </div>
                    <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                </>
            )}
        </div>
    );
}

function BlogCard({ post }: { post: KernelObject }) {
    const title = (post.payload.title as string) ?? 'Untitled';
    const body = (post.payload.body as string) ?? '';
    const excerpt = body.replace(/[*#\[\]()]/g, '').slice(0, 250);

    return (
        <Link
            to={`/blogs/${post.object_id}`}
            className="block bg-white rounded-lg border border-koa-200 p-6 hover:border-koa-300 transition-colors"
        >
            <h2 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">{title}</h2>
            <TimeAgo timestamp={post.created_at} className="text-xs" />
            <p className="mt-2 text-sm text-gray-600 line-clamp-3">{excerpt}</p>
        </Link>
    );
}
