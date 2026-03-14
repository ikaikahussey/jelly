import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/lib/api-client';

interface RegistryApp {
	appId: string;
	ownerId: string;
	title: string;
	description: string | null;
	subdomain: string | null;
	thumbnailR2Key: string | null;
	listingId: string | null;
	createdAt: number;
	ownerName: string | null;
}

interface AppRegistryProps {
	className?: string;
}

export function AppRegistry({ className }: AppRegistryProps) {
	const [apps, setApps] = useState<RegistryApp[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [cursor, setCursor] = useState<string | undefined>();
	const [hasMore, setHasMore] = useState(false);

	const fetchApps = useCallback(
		async (nextCursor?: string) => {
			try {
				const params = new URLSearchParams();
				params.set('limit', '20');
				if (searchQuery) params.set('search', searchQuery);
				if (nextCursor) params.set('cursor', nextCursor);

				const response = await apiClient.request<{
					apps: RegistryApp[];
					cursor?: string;
				}>(`/api/kernel/registry?${params}`);

				if (nextCursor) {
					setApps((prev) => [...prev, ...response.apps]);
				} else {
					setApps(response.apps);
				}
				setCursor(response.cursor);
				setHasMore(!!response.cursor);
			} catch (error) {
				console.error('Failed to fetch registry:', error);
			} finally {
				setLoading(false);
			}
		},
		[searchQuery]
	);

	useEffect(() => {
		setLoading(true);
		fetchApps();
	}, [fetchApps]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		fetchApps();
	};

	return (
		<div className={cn('space-y-6', className)}>
			<form onSubmit={handleSearch} className="flex gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
					<Input
						placeholder="Search published apps..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button type="submit" variant="outline">
					Search
				</Button>
			</form>

			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
				</div>
			) : apps.length === 0 ? (
				<div className="text-center py-12 text-text-tertiary">
					<p className="text-lg">No apps found</p>
					<p className="text-sm mt-1">
						{searchQuery
							? 'Try a different search term.'
							: 'No published apps yet.'}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{apps.map((app) => (
						<RegistryCard key={app.appId} app={app} />
					))}
				</div>
			)}

			{hasMore && !loading && (
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

function RegistryCard({ app }: { app: RegistryApp }) {
	return (
		<Card className="p-4 hover:border-accent/50 transition-colors">
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-text-primary truncate">
						{app.title}
					</h4>
					{app.description && (
						<p className="text-sm text-text-tertiary mt-1 line-clamp-2">
							{app.description}
						</p>
					)}
					<div className="flex items-center gap-2 mt-2">
						{app.ownerName && (
							<span className="text-xs text-text-tertiary">
								by {app.ownerName}
							</span>
						)}
						<span className="text-xs text-text-tertiary">
							{formatDistanceToNow(new Date(app.createdAt), {
								addSuffix: true,
							})}
						</span>
					</div>
					{app.listingId && (
						<span className="inline-block mt-2 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
							Premium
						</span>
					)}
				</div>
				{app.subdomain && (
					<a
						href={`https://${app.subdomain}`}
						target="_blank"
						rel="noopener noreferrer"
						className="ml-2"
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
		</Card>
	);
}
