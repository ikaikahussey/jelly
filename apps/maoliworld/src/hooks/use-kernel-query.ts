import { useState, useEffect, useCallback, useRef } from 'react';

interface UseKernelQueryOptions<T> {
    queryFn: () => Promise<T>;
    enabled?: boolean;
}

interface UseKernelQueryResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useKernelQuery<T>({
    queryFn,
    enabled = true,
}: UseKernelQueryOptions<T>): UseKernelQueryResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const queryFnRef = useRef(queryFn);
    queryFnRef.current = queryFn;

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await queryFnRef.current();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            void refetch();
        }
    }, [enabled, refetch]);

    return { data, loading, error, refetch };
}

interface UsePaginatedQueryOptions<TItem> {
    queryFn: (cursor?: string) => Promise<{ items: TItem[]; cursor?: string }>;
    enabled?: boolean;
}

interface UsePaginatedQueryResult<TItem> {
    items: TItem[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    refetch: () => Promise<void>;
}

export function usePaginatedQuery<TItem>({
    queryFn,
    enabled = true,
}: UsePaginatedQueryOptions<TItem>): UsePaginatedQueryResult<TItem> {
    const [items, setItems] = useState<TItem[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<string | undefined>();
    const [hasMore, setHasMore] = useState(true);
    const queryFnRef = useRef(queryFn);
    queryFnRef.current = queryFn;

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await queryFnRef.current();
            setItems(result.items);
            setCursor(result.cursor);
            setHasMore(!!result.cursor);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await queryFnRef.current(cursor);
            setItems(prev => [...prev, ...result.items]);
            setCursor(result.cursor);
            setHasMore(!!result.cursor);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, loadingMore]);

    useEffect(() => {
        if (enabled) {
            void refetch();
        }
    }, [enabled, refetch]);

    return { items, loading, loadingMore, error, hasMore, loadMore, refetch };
}
