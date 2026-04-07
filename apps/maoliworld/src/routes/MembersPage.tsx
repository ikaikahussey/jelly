import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, type KernelObject } from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';
import { LoadMore } from '@/components/shared/LoadMore';

export function MembersPage() {
    const [search, setSearch] = useState('');

    const queryFn = useCallback(
        (cursor?: string) =>
            objects
                .query({
                    type: 'profile',
                    visibility: 'public',
                    q: search || undefined,
                    limit: 24,
                    cursor,
                })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        [search]
    );

    const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedQuery<KernelObject>({
        queryFn,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-koa-900">Members</h1>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members..."
                    className="px-3 py-2 border border-koa-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-kai-300"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="bg-white rounded-lg border border-koa-200 p-4 animate-pulse h-32" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-koa-400 text-center py-12">No members found.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {items.map(profile => (
                            <MemberCard key={profile.object_id} profile={profile} />
                        ))}
                    </div>
                    <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                </>
            )}
        </div>
    );
}

function MemberCard({ profile }: { profile: KernelObject }) {
    const payload = profile.payload;
    const name = (payload.display_name as string | undefined) ?? 'Member';
    const location = payload.location as string | undefined;
    const avatarKey = payload.avatar_r2_key as string | undefined;

    return (
        <Link
            to={`/members/${profile.owner_id}`}
            className="bg-white rounded-lg border border-koa-200 p-4 hover:border-koa-300 transition-colors flex flex-col items-center text-center"
        >
            <Avatar
                avatarKey={avatarKey ?? null}
                name={name}
                size="lg"
                className="mb-3"
            />
            <h3 className="text-sm font-semibold text-gray-900 truncate w-full">{name}</h3>
            {location && (
                <p className="text-xs text-koa-400 truncate w-full">{location}</p>
            )}
        </Link>
    );
}
