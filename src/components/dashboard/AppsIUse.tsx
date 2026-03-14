import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pin, PinOff, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/lib/api-client';

interface AppAccessEntry {
	appId: string;
	title?: string;
	description?: string | null;
	subdomain?: string | null;
	pinned: number | null;
	lastAccessedAt: number;
	role: string;
}

interface AppsIUseProps {
	className?: string;
}

export function AppsIUse({ className }: AppsIUseProps) {
	const [apps, setApps] = useState<AppAccessEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [cursor, setCursor] = useState<string | undefined>();
	const [hasMore, setHasMore] = useState(false);

	const fetchApps = useCallback(async (nextCursor?: string) => {
		try {
			const params = new URLSearchParams();
			params.set('limit', '20');
			if (nextCursor) params.set('cursor', nextCursor);

			const response = await apiClient.request<{
				apps: AppAccessEntry[];
				cursor?: string;
			}>(`/api/kernel/dashboard/apps-i-use?${params}`);

			if (nextCursor) {
				setApps((prev) => [...prev, ...response.apps]);
			} else {
				setApps(response.apps);
			}
			setCursor(response.cursor);
			setHasMore(!!response.cursor);
		} catch (error) {
			console.error('Failed to fetch apps I use:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchApps();
	}, [fetchApps]);

	const handleTogglePin = async (appId: string, currentlyPinned: boolean) => {
		try {
			await apiClient.request('/api/kernel/dashboard/pin', {
				method: 'POST',
				body: JSON.stringify({ app_id: appId, pinned: !currentlyPinned }),
			});
			setApps((prev) =>
				prev.map((app) =>
					app.appId === appId
						? { ...app, pinned: currentlyPinned ? 0 : 1 }
						: app
				)
			);
		} catch (error) {
			console.error('Failed to toggle pin:', error);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
			</div>
		);
	}

	if (apps.length === 0) {
		return (
			<div className="text-center py-12 text-text-tertiary">
				<p className="text-lg">No apps accessed yet</p>
				<p className="text-sm mt-1">Apps you visit will appear here.</p>
			</div>
		);
	}

	const pinnedApps = apps.filter((a) => a.pinned === 1);
	const recentApps = apps.filter((a) => a.pinned !== 1);

	return (
		<div className={cn('space-y-6', className)}>
			{pinnedApps.length > 0 && (
				<div>
					<h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
						Pinned
					</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{pinnedApps.map((app) => (
							<AppAccessCard
								key={app.appId}
								app={app}
								onTogglePin={handleTogglePin}
							/>
						))}
					</div>
				</div>
			)}

			<div>
				{pinnedApps.length > 0 && (
					<h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
						Recent
					</h3>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{recentApps.map((app) => (
						<AppAccessCard
							key={app.appId}
							app={app}
							onTogglePin={handleTogglePin}
						/>
					))}
				</div>
			</div>

			{hasMore && (
				<div className="text-center">
					<Button
						variant="outline"
						onClick={() => fetchApps(cursor)}
					>
						Load more
					</Button>
				</div>
			)}
		</div>
	);
}

function AppAccessCard({
	app,
	onTogglePin,
}: {
	app: AppAccessEntry;
	onTogglePin: (appId: string, pinned: boolean) => void;
}) {
	const isPinned = app.pinned === 1;

	return (
		<Card className="p-4 hover:border-accent/50 transition-colors group">
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-text-primary truncate">
						{app.title ?? app.appId}
					</h4>
					{app.description && (
						<p className="text-sm text-text-tertiary mt-1 line-clamp-2">
							{app.description}
						</p>
					)}
					<p className="text-xs text-text-tertiary mt-2">
						Last used{' '}
						{formatDistanceToNow(new Date(app.lastAccessedAt), {
							addSuffix: true,
						})}
					</p>
				</div>
				<div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={() => onTogglePin(app.appId, isPinned)}
						title={isPinned ? 'Unpin' : 'Pin'}
					>
						{isPinned ? (
							<PinOff className="h-3.5 w-3.5" />
						) : (
							<Pin className="h-3.5 w-3.5" />
						)}
					</Button>
					{app.subdomain && (
						<a
							href={`https://${app.subdomain}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								title="Open app"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</Button>
						</a>
					)}
				</div>
			</div>
		</Card>
	);
}
