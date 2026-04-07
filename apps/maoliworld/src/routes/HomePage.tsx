import { useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { feed, type KernelObject } from '@/lib/api-client';
import { FeedCard } from '@/components/feed/FeedCard';
import { LoadMore } from '@/components/shared/LoadMore';

export function HomePage() {
    const { user } = useAuth();

    const queryFn = useCallback(
        (cursor?: string) =>
            feed.getGlobal({ limit: 20, cursor }).then(r => ({
                items: r.objects,
                cursor: r.cursor,
            })),
        []
    );

    const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedQuery<KernelObject>({
        queryFn,
    });

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-xl border border-koa-200 p-6 md:p-8">
                <h1 className="text-2xl font-bold text-koa-900 mb-2">
                    Aloha{user ? `, ${user.display_name ?? ''}` : ''}!
                </h1>
                <p className="text-koa-600">
                    Welcome to Maoliworld, a gathering place for the global Kanaka Maoli community.
                </p>
                {!user && (
                    <div className="mt-4 flex gap-3">
                        <a
                            href="/api/auth/login"
                            className="inline-flex items-center px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 transition-colors"
                        >
                            Join the community
                        </a>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 space-y-4">
                    <h2 className="text-lg font-semibold text-koa-800">Recent Activity</h2>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 3 }, (_, i) => (
                                <div key={i} className="bg-white rounded-lg border border-koa-200 p-4 animate-pulse h-32" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-koa-400 text-sm py-8 text-center">
                            No activity yet. Be the first to post!
                        </p>
                    ) : (
                        <>
                            {items.map(obj => (
                                <FeedCard key={obj.object_id} object={obj} />
                            ))}
                            <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                        </>
                    )}
                </div>

                <aside className="space-y-4">
                    <div className="bg-white rounded-lg border border-koa-200 p-4">
                        <h3 className="text-sm font-semibold text-koa-700 mb-3">Quick Links</h3>
                        <nav className="space-y-2">
                            <Link to="/forums" className="block text-sm text-kai-600 hover:text-kai-800">
                                Discussion Forums
                            </Link>
                            <Link to="/blogs" className="block text-sm text-kai-600 hover:text-kai-800">
                                Member Blogs
                            </Link>
                            <Link to="/photos" className="block text-sm text-kai-600 hover:text-kai-800">
                                Photo Gallery
                            </Link>
                            <Link to="/members" className="block text-sm text-kai-600 hover:text-kai-800">
                                Members Directory
                            </Link>
                        </nav>
                    </div>
                </aside>
            </div>
        </div>
    );
}
