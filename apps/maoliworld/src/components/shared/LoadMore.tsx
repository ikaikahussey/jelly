interface LoadMoreProps {
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}

export function LoadMore({ loading, hasMore, onLoadMore }: LoadMoreProps) {
    if (!hasMore) return null;

    return (
        <div className="flex justify-center py-4">
            <button
                onClick={onLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-koa-700 bg-white border border-koa-300 rounded-lg hover:bg-koa-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? 'Loading...' : 'Load more'}
            </button>
        </div>
    );
}
