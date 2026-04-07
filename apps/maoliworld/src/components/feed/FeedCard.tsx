import { Link } from 'react-router';
import { type KernelObject, media } from '@/lib/api-client';
import { TimeAgo } from '@/components/shared/TimeAgo';

interface FeedCardProps {
    object: KernelObject;
}

const TYPE_LABELS: Record<string, { label: string; route: string }> = {
    forum_post: { label: 'Forum Post', route: '/forums' },
    blog_post: { label: 'Blog Post', route: '/blogs' },
    comment: { label: 'Comment', route: '' },
    photo: { label: 'Photo', route: '/photos' },
    event: { label: 'Event', route: '' },
};

export function FeedCard({ object }: FeedCardProps) {
    const typeInfo = TYPE_LABELS[object.object_type];
    const payload = object.payload;
    const title = (payload.title as string | undefined) ?? '';
    const body = (payload.body as string | undefined) ?? '';
    const photoKey = payload.media_key as string | undefined;

    const linkTo = typeInfo
        ? `${typeInfo.route}/${object.object_id}`
        : '#';

    return (
        <div className="bg-white rounded-lg border border-koa-200 p-4 hover:border-koa-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-koa-500 uppercase tracking-wide">
                    {typeInfo?.label ?? object.object_type}
                </span>
                <TimeAgo timestamp={object.created_at} className="text-xs" />
            </div>

            {title && (
                <Link to={linkTo} className="block mb-1">
                    <h3 className="text-base font-semibold text-gray-900 hover:text-kai-700 line-clamp-2">
                        {title}
                    </h3>
                </Link>
            )}

            {body && (
                <p className="text-sm text-gray-600 line-clamp-3 mb-2">
                    {body.replace(/[*#\[\]()]/g, '').slice(0, 200)}
                </p>
            )}

            {photoKey && (
                <img
                    src={media.url(photoKey)}
                    alt={title || 'Photo'}
                    className="mt-2 rounded-md max-h-48 w-full object-cover"
                />
            )}
        </div>
    );
}
