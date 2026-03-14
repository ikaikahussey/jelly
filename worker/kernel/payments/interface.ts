/**
 * Payment Provider Interface
 * Pluggable abstraction for external money movement (deposits/withdrawals).
 * The kernel ledger handles all internal transactions; this interface handles
 * the bridge to real money via Stripe or other providers.
 */

export interface PaymentEvent {
    type: 'checkout.completed' | 'payout.completed' | 'subscription.cancelled' | 'refund.completed';
    externalId: string;
    buyerId?: string;
    sellerId?: string;
    amountCents: number;
    platformFeeCents?: number;
    listingId?: string;
    subscriptionId?: string;
    metadata?: Record<string, string>;
}

export interface PaymentProvider {
    /**
     * Create a connected seller account for payouts.
     * Returns an account ID and an onboarding URL the seller must visit.
     */
    createSellerAccount(userId: string): Promise<{
        accountId: string;
        onboardingUrl: string;
    }>;

    /**
     * Create a checkout session for a buyer purchasing a listing.
     * Returns a URL the buyer should be redirected to.
     */
    createCheckout(params: {
        buyerId: string;
        sellerId: string;
        listingId: string;
        amountCents: number;
        platformFeeCents: number;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{ checkoutUrl: string; externalPaymentId: string }>;

    /**
     * Verify and parse an incoming webhook from the payment provider.
     */
    verifyWebhook(request: Request): Promise<PaymentEvent>;

    /**
     * Initiate a payout to a seller's connected account.
     */
    createPayout(sellerId: string, amountCents: number): Promise<{ payoutId: string }>;

    /**
     * Cancel a recurring subscription.
     */
    cancelSubscription(subscriptionId: string): Promise<void>;

    /**
     * Check if a seller account has completed onboarding and can receive payouts.
     */
    isSellerReady(externalAccountId: string): Promise<boolean>;
}

/**
 * No-op payment provider for development/testing.
 * All operations succeed without external calls.
 */
export class NoopPaymentProvider implements PaymentProvider {
    async createSellerAccount(userId: string) {
        return {
            accountId: `noop_${userId}`,
            onboardingUrl: '#',
        };
    }

    async createCheckout(params: {
        buyerId: string;
        sellerId: string;
        listingId: string;
        amountCents: number;
        platformFeeCents: number;
        successUrl: string;
        cancelUrl: string;
    }) {
        return {
            checkoutUrl: params.successUrl,
            externalPaymentId: `noop_${crypto.randomUUID()}`,
        };
    }

    async verifyWebhook(_request: Request): Promise<PaymentEvent> {
        throw new Error('NoopPaymentProvider does not support webhooks');
    }

    async createPayout(_sellerId: string, _amountCents: number) {
        return { payoutId: `noop_payout_${crypto.randomUUID()}` };
    }

    async cancelSubscription(_subscriptionId: string) {
        // no-op
    }

    async isSellerReady(_externalAccountId: string) {
        return true;
    }
}
