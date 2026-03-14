import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/lib/api-client';

interface ComponentEntry {
	component_id: string;
	owner_id: string;
	name: string;
	description: string | null;
	interface: { provides: string[]; consumes: string[] } | null;
	source_app_id: string | null;
	listing_id: string | null;
	created_at: number;
	updated_at: number;
	owner_name: string | null;
}

interface ComponentMarketplaceProps {
	className?: string;
	onSelectListing?: (listingId: string) => void;
}

export function ComponentMarketplace({ className, onSelectListing }: ComponentMarketplaceProps) {
	const [components, setComponents] = useState<ComponentEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [cursor, setCursor] = useState<string | undefined>();
	const [hasMore, setHasMore] = useState(false);

	const fetchComponents = useCallback(async (nextCursor?: string) => {
		try {
			const params = new URLSearchParams();
			params.set('limit', '20');
			if (searchQuery) params.set('q', searchQuery);
			if (nextCursor) params.set('cursor', nextCursor);

			const response = await apiClient.request<{
				components: ComponentEntry[];
				cursor?: string;
			}>(`/api/kernel/components?${params}`);

			if (nextCursor) {
				setComponents((prev) => [...prev, ...response.components]);
			} else {
				setComponents(response.components);
			}
			setCursor(response.cursor);
			setHasMore(!!response.cursor);
		} catch (error) {
			console.error('Failed to fetch components:', error);
		} finally {
			setLoading(false);
		}
	}, [searchQuery]);

	useEffect(() => {
		setLoading(true);
		const timeoutId = setTimeout(() => {
			fetchComponents();
		}, 300);
		return () => clearTimeout(timeoutId);
	}, [fetchComponents]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		fetchComponents();
	};

	return (
		<div className={cn('space-y-4', className)}>
			<form onSubmit={handleSearch} className="flex gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search components..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>
			</form>

			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : components.length === 0 ? (
				<div className="text-center py-12">
					<Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
					<p className="text-sm text-muted-foreground">
						{searchQuery ? 'No components match your search' : 'No components available yet'}
					</p>
				</div>
			) : (
				<>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{components.map((component) => (
							<Card
								key={component.component_id}
								className="p-4 hover:shadow-md transition-shadow"
							>
								<div className="flex items-start justify-between mb-2">
									<h3 className="font-medium text-sm truncate flex-1">
										{component.name}
									</h3>
									{component.listing_id && (
										<Badge variant="secondary" className="ml-2 text-xs shrink-0">
											Premium
										</Badge>
									)}
								</div>

								{component.description && (
									<p className="text-xs text-muted-foreground mb-3 line-clamp-2">
										{component.description}
									</p>
								)}

								{component.interface && (
									<div className="mb-3 space-y-1">
										{component.interface.provides.length > 0 && (
											<div className="flex flex-wrap gap-1">
												{component.interface.provides.slice(0, 3).map((p) => (
													<Badge key={p} variant="outline" className="text-xs">
														{p}
													</Badge>
												))}
												{component.interface.provides.length > 3 && (
													<Badge variant="outline" className="text-xs">
														+{component.interface.provides.length - 3}
													</Badge>
												)}
											</div>
										)}
									</div>
								)}

								<div className="flex items-center justify-between text-xs text-muted-foreground">
									<span>{component.owner_name ?? 'Unknown'}</span>
									<span>
										{formatDistanceToNow(new Date(component.created_at), { addSuffix: true })}
									</span>
								</div>

								{component.listing_id && onSelectListing && (
									<Button
										variant="outline"
										size="sm"
										className="w-full mt-3"
										onClick={() => onSelectListing(component.listing_id!)}
									>
										View Listing
									</Button>
								)}
							</Card>
						))}
					</div>

					{hasMore && (
						<div className="flex justify-center pt-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => fetchComponents(cursor)}
							>
								Load more
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
