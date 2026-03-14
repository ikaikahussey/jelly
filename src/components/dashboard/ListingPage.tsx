import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, ExternalLink, Loader2, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ListingDetail {
	listing_id: string;
	seller_id: string;
	item_type: string;
	item_id: string;
	price_cents: number | null;
	pricing_model: string;
	active: boolean;
	created_at: number;
	seller_name: string | null;
}

interface ListingPageProps {
	listingId: string;
	onClose: () => void;
}

export function ListingPage({ listingId, onClose }: ListingPageProps) {
	const [listing, setListing] = useState<ListingDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [purchasing, setPurchasing] = useState(false);
	const [purchased, setPurchased] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchListing() {
			try {
				const response = await apiClient.request<ListingDetail>(
					`/api/kernel/listings/${listingId}`
				);
				setListing(response);
			} catch (err) {
				setError('Failed to load listing');
			} finally {
				setLoading(false);
			}
		}
		fetchListing();
	}, [listingId]);

	const handleCheckout = async () => {
		if (!listing) return;
		setPurchasing(true);
		setError(null);

		try {
			const result = await apiClient.request<{
				checkout_url?: string;
				purchase_id?: string;
				free?: boolean;
			}>('/api/kernel/purchases/checkout', {
				method: 'POST',
				body: JSON.stringify({
					listing_id: listingId,
					success_url: window.location.href,
					cancel_url: window.location.href,
				}),
			});

			if (result.free) {
				setPurchased(true);
			} else if (result.checkout_url) {
				window.location.href = result.checkout_url;
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Checkout failed');
		} finally {
			setPurchasing(false);
		}
	};

	if (loading) {
		return (
			<Card className="p-8 flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</Card>
		);
	}

	if (!listing) {
		return (
			<Card className="p-8">
				<p className="text-sm text-muted-foreground">{error ?? 'Listing not found'}</p>
				<Button variant="ghost" size="sm" onClick={onClose} className="mt-4">
					Go back
				</Button>
			</Card>
		);
	}

	const priceDisplay = listing.price_cents
		? `$${(listing.price_cents / 100).toFixed(2)}`
		: 'Free';

	const pricingLabel = listing.pricing_model === 'monthly'
		? '/month'
		: listing.pricing_model === 'usage'
			? '/use'
			: '';

	return (
		<Card className="p-6 max-w-lg mx-auto">
			<div className="flex items-start justify-between mb-4">
				<div>
					<h2 className="text-xl font-semibold">
						{listing.item_type === 'app' ? 'App' : listing.item_type === 'component' ? 'Component' : 'Template'}
					</h2>
					{listing.seller_name && (
						<p className="text-sm text-muted-foreground mt-1">
							by {listing.seller_name}
						</p>
					)}
				</div>
				<Badge variant={listing.active ? 'default' : 'secondary'}>
					{listing.active ? 'Available' : 'Unavailable'}
				</Badge>
			</div>

			<div className="flex items-baseline gap-1 mb-6">
				<span className="text-3xl font-bold">{priceDisplay}</span>
				{pricingLabel && (
					<span className="text-sm text-muted-foreground">{pricingLabel}</span>
				)}
			</div>

			{error && (
				<p className="text-sm text-destructive mb-4">{error}</p>
			)}

			<div className="flex gap-3">
				{purchased ? (
					<Button disabled className="flex-1">
						<Check className="h-4 w-4 mr-2" />
						Purchased
					</Button>
				) : (
					<Button
						onClick={handleCheckout}
						disabled={purchasing || !listing.active}
						className="flex-1"
					>
						{purchasing ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<ShoppingCart className="h-4 w-4 mr-2" />
						)}
						{listing.price_cents ? 'Purchase' : 'Get for Free'}
					</Button>
				)}
				<Button variant="outline" onClick={onClose}>
					Back
				</Button>
			</div>
		</Card>
	);
}
