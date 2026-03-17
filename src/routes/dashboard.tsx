import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/contexts/auth-context';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { toggleFavorite } from '@/hooks/use-apps';
import { AppListContainer } from '@/components/shared/AppListContainer';
import { AppsIUse } from '@/components/dashboard/AppsIUse';
import { AppRegistry } from '@/components/dashboard/AppRegistry';
import { ComponentMarketplace } from '@/components/dashboard/ComponentMarketplace';
import { ListingPage } from '@/components/dashboard/ListingPage';
import { cn } from '@/lib/utils';

type DashboardTab = 'my-apps' | 'apps-i-use' | 'registry' | 'components';

export default function Dashboard() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState<DashboardTab>('my-apps');

	const activeListingId = searchParams.get('listing');

	const {
		apps,
		loading,
		loadingMore,
		error,
		totalCount,
		hasMore,
		refetch,
		loadMore,
	} = usePaginatedApps({
		type: 'user',
		defaultSort: 'recent',
		limit: 12,
	});

	const handleToggleFavorite = async (appId: string) => {
		try {
			await toggleFavorite(appId);
			refetch();
		} catch (error) {
			console.error('Failed to toggle favorite:', error);
		}
	};

	const handleSelectListing = (listingId: string) => {
		setSearchParams({ listing: listingId });
	};

	const handleCloseListing = () => {
		searchParams.delete('listing');
		setSearchParams(searchParams);
	};

	const tabs: { id: DashboardTab; label: string; ascii: string }[] = [
		{ id: 'my-apps', label: 'My Apps', ascii: '[1]' },
		{ id: 'apps-i-use', label: 'Apps I Use', ascii: '[2]' },
		{ id: 'registry', label: 'Registry', ascii: '[3]' },
		{ id: 'components', label: 'Components', ascii: '[4]' },
	];

	if (activeListingId) {
		return (
			<div className="min-h-screen bg-bg-3">
				<div className="container mx-auto px-4 py-8">
					<ListingPage
						listingId={activeListingId}
						onClose={handleCloseListing}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-bg-3">
			{/* Dithered background */}
			<div className="fixed inset-0 z-0 opacity-20 pointer-events-none bg-dots text-text-tertiary" />

			<div className="container mx-auto px-4 py-8 relative z-10">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					{/* Header */}
					<div className="mb-6">
						<div className="flex items-baseline gap-4 mb-2">
							<h1 className="text-2xl tracking-widest uppercase text-text-primary">
								// DASHBOARD
							</h1>
							{user && (
								<span className="text-xs text-text-tertiary">
									logged in as {user.displayName}
								</span>
							)}
						</div>
						<div className="border-t border-dashed border-text-tertiary" />
					</div>

					{/* Tabs -- retro button bar */}
					<div className="flex gap-0 mb-6 border-2 border-text-primary w-fit">
						{tabs.map((tab, i) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									'px-4 py-1.5 text-xs tracking-wider uppercase transition-colors',
									i > 0 && 'border-l border-text-primary',
									activeTab === tab.id
										? 'bg-text-primary text-text-inverted'
										: 'bg-bg-4 text-text-secondary hover:bg-bg-2'
								)}
							>
								<span className="text-[10px] mr-1 opacity-60">{tab.ascii}</span>
								{tab.label}
							</button>
						))}
					</div>

					{/* Tab Content */}
					{activeTab === 'my-apps' && (
						<AppListContainer
							apps={apps}
							loading={loading}
							loadingMore={loadingMore}
							error={error}
							hasMore={hasMore}
							totalCount={totalCount}
							sortBy="recent"
							onAppClick={(appId) => navigate(`/app/${appId}`)}
							onToggleFavorite={handleToggleFavorite}
							onLoadMore={loadMore}
							onRetry={refetch}
							showUser={false}
							showStats={true}
							showActions={true}
							infiniteScroll={true}
							emptyState={{
								title: 'No apps yet',
								description:
									'Start building your first app with AI assistance.',
							}}
						/>
					)}

					{activeTab === 'apps-i-use' && <AppsIUse />}

					{activeTab === 'registry' && <AppRegistry />}

					{activeTab === 'components' && (
						<ComponentMarketplace
							onSelectListing={handleSelectListing}
						/>
					)}
				</motion.div>
			</div>
		</div>
	);
}
