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

	// Listing modal from URL param (?listing=xxx)
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

	const tabs: { id: DashboardTab; label: string }[] = [
		{ id: 'my-apps', label: 'My Apps' },
		{ id: 'apps-i-use', label: 'Apps I Use' },
		{ id: 'registry', label: 'App Registry' },
		{ id: 'components', label: 'Components' },
	];

	// Show listing page as overlay if URL param is set
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
			<div className="container mx-auto px-4 py-8">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					{/* Header */}
					<div className="mb-8">
						<h1 className="text-4xl font-bold mb-2 font-[departureMono] text-accent">
							DASHBOARD
						</h1>
						{user && (
							<p className="text-text-tertiary">
								Welcome back, {user.displayName}
							</p>
						)}
					</div>

					{/* Tabs */}
					<div className="flex gap-1 mb-8 border-b border-border">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
									activeTab === tab.id
										? 'border-accent text-accent'
										: 'border-transparent text-text-tertiary hover:text-text-secondary'
								)}
							>
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
