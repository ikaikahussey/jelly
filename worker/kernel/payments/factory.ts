/**
 * Payment Provider Factory
 * Instantiates the correct payment provider based on environment config.
 */

import type { PaymentProvider } from './interface';
import { NoopPaymentProvider } from './interface';
import { StripePaymentProvider } from './stripe';
import { createLogger } from '../../logger';

const logger = createLogger('PaymentFactory');

/**
 * Create the appropriate payment provider based on PAYMENT_PROVIDER env var.
 * Defaults to NoopPaymentProvider for development.
 */
export function createPaymentProvider(env: Env): PaymentProvider {
    const providerName = (env as Record<string, string>).PAYMENT_PROVIDER ?? 'none';

    switch (providerName) {
        case 'stripe':
            logger.info('Using Stripe payment provider');
            return new StripePaymentProvider(env as unknown as {
                STRIPE_SECRET_KEY: string;
                STRIPE_WEBHOOK_SECRET: string;
                ROOT_DOMAIN?: string;
            });
        case 'none':
        default:
            logger.info('Using no-op payment provider');
            return new NoopPaymentProvider();
    }
}
