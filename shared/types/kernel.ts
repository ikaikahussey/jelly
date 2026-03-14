/**
 * Shared Kernel Types
 * Used by both frontend and @jelly/platform SDK.
 */

export interface KernelUserProfile {
    user_id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    profile: Record<string, unknown>;
}

export type KernelVisibility = 'private' | 'relationships' | 'public';

export interface KernelRelationshipEdge {
    from_user: string;
    to_user: string;
    rel_type: string;
    metadata: Record<string, unknown>;
    created_at: number;
}

export interface KernelPlatformObject {
    object_id: string;
    owner_id: string;
    object_type: string;
    payload: Record<string, unknown>;
    visibility: KernelVisibility;
    parent_id: string | null;
    created_at: number;
    updated_at: number;
}

export interface KernelLedgerEntry {
    entry_id: string;
    user_id: string;
    amount: number;
    balance_after: number;
    entry_type: string;
    reference_id: string | null;
    counterparty_id: string | null;
    created_at: number;
}

export interface KernelPaginatedResponse<T> {
    cursor?: string;
}

export interface KernelGraphQueryResult extends KernelPaginatedResponse<KernelRelationshipEdge> {
    edges: KernelRelationshipEdge[];
}

export interface KernelObjectsQueryResult extends KernelPaginatedResponse<KernelPlatformObject> {
    objects: KernelPlatformObject[];
}

export interface KernelLedgerHistoryResult extends KernelPaginatedResponse<KernelLedgerEntry> {
    entries: KernelLedgerEntry[];
}

// ========================================
// Listings & Purchases (Phase 6)
// ========================================

export type KernelListingItemType = 'app' | 'component' | 'template';
export type KernelPricingModel = 'one_time' | 'monthly' | 'usage';
export type KernelPurchaseStatus = 'active' | 'refunded' | 'expired';

export interface KernelListing {
    listing_id: string;
    seller_id: string;
    item_type: KernelListingItemType;
    item_id: string;
    price_cents: number | null;
    pricing_model: KernelPricingModel;
    active: boolean;
    created_at: number;
    seller_name?: string | null;
}

export interface KernelPurchase {
    purchase_id: string;
    buyer_id: string;
    listing_id: string;
    amount_cents: number;
    platform_fee_cents: number;
    status: KernelPurchaseStatus;
    purchased_at: number;
}

export interface KernelPaymentStatus {
    connected: boolean;
    onboarding_complete: boolean;
    payout_enabled: boolean;
    provider?: string;
}

export interface KernelListingsQueryResult extends KernelPaginatedResponse<KernelListing> {
    listings: KernelListing[];
}

export interface KernelPurchasesQueryResult extends KernelPaginatedResponse<KernelPurchase> {
    purchases: KernelPurchase[];
}

// ========================================
// Components (Phase 7)
// ========================================

export interface KernelComponentInterface {
    provides: string[];
    consumes: string[];
}

export interface KernelComponent {
    component_id: string;
    owner_id: string;
    name: string;
    description: string | null;
    r2_bundle_key: string;
    interface: KernelComponentInterface | null;
    source_app_id: string | null;
    listing_id: string | null;
    created_at: number;
    updated_at: number;
    owner_name?: string | null;
}

export interface KernelComponentsQueryResult extends KernelPaginatedResponse<KernelComponent> {
    components: KernelComponent[];
}
