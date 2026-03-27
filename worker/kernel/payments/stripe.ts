/**
 * Stripe Payment Provider Adapter
 * Bridges external money movement to the kernel ledger via Stripe Connect.
 * Uses Stripe's API directly (no SDK dependency in Workers).
 */

import type { PaymentProvider, PaymentEvent } from './interface';
import { createLogger } from '../../logger';

const logger = createLogger('StripePaymentProvider');

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface StripeEnv {
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    ROOT_DOMAIN?: string;
}

export class StripePaymentProvider implements PaymentProvider {
    private readonly secretKey: string;
    private readonly webhookSecret: string;
    private readonly rootDomain: string;

    constructor(env: StripeEnv) {
        this.secretKey = env.STRIPE_SECRET_KEY;
        this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
        this.rootDomain = env.ROOT_DOMAIN ?? 'localhost';
    }

    async createSellerAccount(userId: string): Promise<{
        accountId: string;
        onboardingUrl: string;
    }> {
        // Create a Stripe Connect Express account
        const account = await this.stripeRequest<{ id: string }>('accounts', {
            type: 'express',
            metadata: { jelly_user_id: userId },
        });

        // Create an account link for onboarding
        const link = await this.stripeRequest<{ url: string }>('account_links', {
            account: account.id,
            refresh_url: `https://${this.rootDomain}/dashboard?stripe_refresh=1`,
            return_url: `https://${this.rootDomain}/dashboard?stripe_onboarded=1`,
            type: 'account_onboarding',
        });

        return {
            accountId: account.id,
            onboardingUrl: link.url,
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
    }): Promise<{ checkoutUrl: string; externalPaymentId: string }> {
        const session = await this.stripeRequest<{ id: string; url: string }>(
            'checkout/sessions',
            {
                mode: 'payment',
                'line_items[0][price_data][currency]': 'usd',
                'line_items[0][price_data][product_data][name]': `JLLLY Listing ${params.listingId}`,
                'line_items[0][price_data][unit_amount]': String(params.amountCents),
                'line_items[0][quantity]': '1',
                'payment_intent_data[application_fee_amount]': String(params.platformFeeCents),
                'payment_intent_data[transfer_data][destination]': params.sellerId,
                success_url: params.successUrl,
                cancel_url: params.cancelUrl,
                'metadata[buyer_id]': params.buyerId,
                'metadata[seller_id]': params.sellerId,
                'metadata[listing_id]': params.listingId,
            }
        );

        return {
            checkoutUrl: session.url,
            externalPaymentId: session.id,
        };
    }

    async verifyWebhook(request: Request): Promise<PaymentEvent> {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
            throw new Error('Missing stripe-signature header');
        }

        // Verify the webhook signature
        const verified = await this.verifySignature(body, signature);
        if (!verified) {
            throw new Error('Invalid webhook signature');
        }

        const event = JSON.parse(body) as StripeWebhookEvent;
        return this.mapStripeEvent(event);
    }

    async createPayout(sellerId: string, amountCents: number): Promise<{ payoutId: string }> {
        const transfer = await this.stripeRequest<{ id: string }>('transfers', {
            amount: String(amountCents),
            currency: 'usd',
            destination: sellerId,
        });

        return { payoutId: transfer.id };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await this.stripeRequest(`subscriptions/${subscriptionId}`, {}, 'DELETE');
    }

    async isSellerReady(externalAccountId: string): Promise<boolean> {
        const account = await this.stripeRequest<{
            charges_enabled: boolean;
            payouts_enabled: boolean;
        }>(`accounts/${externalAccountId}`, undefined, 'GET');

        return account.charges_enabled && account.payouts_enabled;
    }

    // -- Internal helpers --

    private async stripeRequest<T>(
        endpoint: string,
        params?: Record<string, string>,
        method: string = 'POST'
    ): Promise<T> {
        const url = `${STRIPE_API_BASE}/${endpoint}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.secretKey}`,
        };

        let body: string | undefined;
        if (method === 'GET') {
            // No body for GET requests
        } else if (params) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            body = new URLSearchParams(params).toString();
        }

        const response = await fetch(url, { method, headers, body });
        if (!response.ok) {
            const errorBody = await response.text();
            logger.error('Stripe API error', { endpoint, status: response.status, body: errorBody });
            throw new Error(`Stripe API error: ${response.status} - ${errorBody}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Verify Stripe webhook signature using Web Crypto API.
     * Implements Stripe's v1 signature scheme (HMAC-SHA256 with timestamp).
     */
    private async verifySignature(payload: string, signatureHeader: string): Promise<boolean> {
        const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});

        const timestamp = parts['t'];
        const expectedSig = parts['v1'];
        if (!timestamp || !expectedSig) return false;

        // Reject timestamps older than 5 minutes
        const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
        if (age > 300) return false;

        const signedPayload = `${timestamp}.${payload}`;
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(this.webhookSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBytes = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(signedPayload)
        );

        const computedSig = Array.from(new Uint8Array(signatureBytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return computedSig === expectedSig;
    }

    private mapStripeEvent(event: StripeWebhookEvent): PaymentEvent {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as StripeCheckoutSession;
                return {
                    type: 'checkout.completed',
                    externalId: session.id,
                    buyerId: session.metadata?.buyer_id,
                    sellerId: session.metadata?.seller_id,
                    amountCents: session.amount_total ?? 0,
                    platformFeeCents: session.total_details?.amount_discount ?? 0,
                    listingId: session.metadata?.listing_id,
                };
            }
            case 'payout.paid': {
                const payout = event.data.object as { id: string; amount: number };
                return {
                    type: 'payout.completed',
                    externalId: payout.id,
                    amountCents: payout.amount,
                };
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object as { id: string; metadata?: Record<string, string> };
                return {
                    type: 'subscription.cancelled',
                    externalId: sub.id,
                    subscriptionId: sub.id,
                    amountCents: 0,
                    metadata: sub.metadata,
                };
            }
            case 'charge.refunded': {
                const charge = event.data.object as {
                    id: string;
                    amount_refunded: number;
                    metadata?: Record<string, string>;
                };
                return {
                    type: 'refund.completed',
                    externalId: charge.id,
                    amountCents: charge.amount_refunded,
                    buyerId: charge.metadata?.buyer_id,
                    listingId: charge.metadata?.listing_id,
                };
            }
            default:
                throw new Error(`Unhandled Stripe event type: ${event.type}`);
        }
    }
}

// -- Stripe types (minimal, no SDK dependency) --

interface StripeWebhookEvent {
    type: string;
    data: {
        object: Record<string, unknown>;
    };
}

interface StripeCheckoutSession {
    id: string;
    amount_total: number | null;
    total_details?: { amount_discount: number };
    metadata?: Record<string, string>;
}
