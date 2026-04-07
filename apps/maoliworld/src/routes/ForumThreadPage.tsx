import { useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useKernelQuery, usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, type KernelObject } from '@/lib/api-client';
import { TimeAgo } from '@/components/shared/TimeAgo';
import { CommentSection } from '@/components/shared/CommentSection';

export function ForumThreadPage() {
    const { postId } = useParams<{ postId: string }>();

    const { data: post, loading } = useKernelQuery({
        queryFn: () => objects.get(postId!),
        enabled: !!postId,
    });

    if (loading) {
        return <div className="animate-pulse h-64 bg-white rounded-lg border border-koa-200" />;
    }

    if (!post) {
        return (
            <div className="text-center py-12">
                <p className="text-koa-400">Discussion not found.</p>
                <Link to="/forums" className="text-kai-600 text-sm mt-2 inline-block">
                    Back to Forums
                </Link>
            </div>
        );
    }

    const title = (post.payload.title as string) ?? 'Untitled';
    const body = (post.payload.body as string) ?? '';

    return (
        <div className="space-y-6">
            <Link to="/forums" className="text-sm text-kai-600 hover:text-kai-800">
                Back to Forums
            </Link>

            <article className="bg-white rounded-xl border border-koa-200 p-6">
                <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
                <TimeAgo timestamp={post.created_at} className="text-xs" />
                <div className="mt-4 prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {body}
                </div>
            </article>

            <CommentSection parentId={post.object_id} />
        </div>
    );
}
