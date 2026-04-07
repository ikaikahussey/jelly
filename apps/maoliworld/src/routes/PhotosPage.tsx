import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePaginatedQuery } from '@/hooks/use-kernel-query';
import { objects, media, type KernelObject } from '@/lib/api-client';
import { LoadMore } from '@/components/shared/LoadMore';
import { TimeAgo } from '@/components/shared/TimeAgo';

export function PhotosPage() {
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<KernelObject | null>(null);

    const queryFn = useCallback(
        (cursor?: string) =>
            objects
                .query({ type: 'photo', visibility: 'public', limit: 24, cursor })
                .then(r => ({ items: r.objects, cursor: r.cursor })),
        []
    );

    const { items, loading, loadingMore, hasMore, loadMore, refetch } =
        usePaginatedQuery<KernelObject>({ queryFn });

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const result = await media.upload(file);
                await objects.create({
                    type: 'photo',
                    payload: {
                        title: file.name.replace(/\.[^.]+$/, ''),
                        media_key: result.key,
                        content_type: result.contentType,
                        size: result.size,
                    },
                    visibility: 'public',
                });
            }
            await refetch();
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-koa-900">Photos</h1>
                {user && (
                    <label className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 transition-colors cursor-pointer">
                        {uploading ? 'Uploading...' : 'Upload Photos'}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="aspect-square bg-koa-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-koa-400 text-center py-12">No photos yet. Upload some!</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {items.map(photo => {
                            const mediaKey = photo.payload.media_key as string | undefined;
                            const title = (photo.payload.title as string) ?? '';
                            if (!mediaKey) return null;
                            return (
                                <button
                                    key={photo.object_id}
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-kai-300 transition-shadow"
                                >
                                    <img
                                        src={media.url(mediaKey)}
                                        alt={title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </button>
                            );
                        })}
                    </div>
                    <LoadMore loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />
                </>
            )}

            {selectedPhoto && (
                <PhotoLightbox
                    photo={selectedPhoto}
                    onClose={() => setSelectedPhoto(null)}
                />
            )}
        </div>
    );
}

function PhotoLightbox({ photo, onClose }: { photo: KernelObject; onClose: () => void }) {
    const mediaKey = photo.payload.media_key as string;
    const title = (photo.payload.title as string) ?? '';

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="max-w-4xl max-h-[90vh] relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300"
                >
                    Close
                </button>
                <img
                    src={media.url(mediaKey)}
                    alt={title}
                    className="max-w-full max-h-[85vh] rounded-lg object-contain"
                />
                {title && (
                    <div className="mt-2 flex items-center justify-between text-white text-sm">
                        <span>{title}</span>
                        <TimeAgo timestamp={photo.created_at} className="text-gray-400 text-xs" />
                    </div>
                )}
            </div>
        </div>
    );
}
