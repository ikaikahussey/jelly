import { useCallback } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { useKernelQuery, usePaginatedQuery } from '@/hooks/use-kernel-query';
import { auth, objects, graph, type KernelUser, type KernelObject } from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';
import { FeedCard } from '@/components/feed/FeedCard';
import { LoadMore } from '@/components/shared/LoadMore';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { FriendButton } from '@/components/profile/FriendButton';

export function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const { user: currentUser } = useAuth();
    const isOwnProfile = currentUser?.user_id === userId;

    const { data: profileUser, loading: loadingUser, refetch: refetchUser } = useKernelQuery({
        queryFn: () => auth.getUser(userId!),
        enabled: !!userId,
    });

    const { data: friendCount } = useKernelQuery({
        queryFn: () => graph.count({ from: userId, type: 'friend' }),
        enabled: !!userId,
    });

    const activityFn = useCallback(
        (cursor?: string) =>
            objects
                .query({ owner: userId, visibility: 'public', limit: 10, cursor })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        [userId]
    );

    const { items: activity, loading: loadingActivity, loadingMore, hasMore, loadMore } =
        usePaginatedQuery<KernelObject>({ queryFn: activityFn, enabled: !!userId });

    if (loadingUser) {
        return <div className="animate-pulse h-64 bg-white rounded-lg border border-koa-200" />;
    }

    if (!profileUser) {
        return <p className="text-center text-koa-400 py-12">Member not found.</p>;
    }

    const profile = profileUser.profile ?? {};
    const bio = profile.bio as string | undefined;
    const location = profile.location as string | undefined;
    const interests = profile.interests as string | undefined;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-koa-200 p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                    <Avatar
                        avatarKey={profileUser.avatar_r2_key}
                        name={profileUser.display_name}
                        size="lg"
                    />
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {profileUser.display_name ?? 'Member'}
                                </h1>
                                {location && (
                                    <p className="text-sm text-koa-500 mt-1">{location}</p>
                                )}
                            </div>
                            {!isOwnProfile && currentUser && (
                                <FriendButton targetUserId={profileUser.user_id} />
                            )}
                        </div>

                        <div className="mt-3 flex gap-4 text-sm text-koa-600">
                            <span><strong className="text-gray-900">{friendCount ?? 0}</strong> friends</span>
                        </div>

                        {bio && <p className="mt-3 text-sm text-gray-700">{bio}</p>}
                        {interests && (
                            <p className="mt-2 text-sm text-koa-500">
                                Interests: {interests}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {isOwnProfile && (
                <ProfileEditor user={profileUser} onSaved={refetchUser} />
            )}

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-koa-800">Recent Activity</h2>
                {loadingActivity ? (
                    <div className="animate-pulse h-32 bg-white rounded-lg border border-koa-200" />
                ) : activity.length === 0 ? (
                    <p className="text-koa-400 text-sm text-center py-8">No public activity yet.</p>
                ) : (
                    <>
                        {activity.map(obj => (
                            <FeedCard key={obj.object_id} object={obj} />
                        ))}
                        <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                    </>
                )}
            </div>
        </div>
    );
}
