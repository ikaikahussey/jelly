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
				<div className="fixed inset-0 z-0 pointer-events-none jelly-bg-pattern" />
				<div className="container mx-auto px-4 py-8 relative z-10">
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
			<div className="fixed inset-0 z-0 pointer-events-none jelly-bg-pattern" />

			<div className="container mx-auto px-4 py-8 relative z-10">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					{/* Dashboard as HyperCard stack */}
					<div className="jelly-card">
						{/* Title bar */}
						<div className="jelly-titlebar flex items-center gap-2 rounded-t-md">
							<span className="jelly-close-box rounded-sm" />
							<span className="flex-1 text-center text-xs text-text-secondary tracking-wider select-none">
								Dashboard
							</span>
							{user && (
								<span className="text-[10px] text-text-tertiary mr-2">
									{user.displayName}
								</span>
							)}
						</div>

						{/* Tab bar -- HyperCard beveled buttons */}
						<div className="flex gap-2 px-4 pt-4 pb-2 border-b border-border-tertiary bg-bg-4 dark:bg-bg-2">
							{tabs.map((tab) => (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={cn(
										'px-3 py-1 text-xs tracking-wider uppercase transition-all duration-100',
										activeTab === tab.id
											? 'jelly-btn-active bg-bg-2 dark:bg-bg-4 text-text-primary'
											: 'jelly-btn bg-bg-4 dark:bg-bg-2 text-text-secondary hover:text-text-primary'
									)}
								>
									<span className="text-[10px] mr-1 opacity-50">{tab.ascii}</span>
									{tab.label}
								</button>
							))}
						</div>

						{/* Card body -- tab content */}
						<div className="p-4 sm:p-6 min-h-[400px]">
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
						</div>

						{/* Card footer */}
						<div className="flex justify-between text-[10px] text-text-tertiary border-t border-border-tertiary px-4 py-1.5 bg-bg-2 rounded-b-md">
							<span>Card 1 of {tabs.length}</span>
							<span>{activeTab.replace('-', ' ')}</span>
						</div>
					</div>
				</motion.div>
			</div>
		</div>
	);
}
