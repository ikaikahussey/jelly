/**
 * Kernel API Routes
 * All routes under /api/kernel/* for the four kernel primitives
 * plus listings, purchases, payments, and components.
 */

import { KernelController } from '../controllers/kernel/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupKernelRoutes(app: Hono<AppEnv>): void {
    const kernel = new Hono<AppEnv>();

    // --- Auth / Users ---
    kernel.get('/auth/me', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getMe));
    kernel.get('/users/:id', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.getUser));
    kernel.patch('/users/me', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.updateMe));

    // --- Graph (Relationships) ---
    kernel.get('/graph/count', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.countEdges));
    kernel.post('/graph/check', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.batchCheckEdges));
    kernel.post('/graph', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.createRelationship));
    kernel.delete('/graph', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.deleteRelationship));
    kernel.get('/graph', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.queryRelationships));

    // --- Objects ---
    kernel.post('/objects', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.createObject));
    kernel.get('/objects/:id', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.getObject));
    kernel.patch('/objects/:id', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.updateObject));
    kernel.delete('/objects/:id', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.deleteObject));
    kernel.get('/objects', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.queryObjects));

    // --- Ledger ---
    kernel.get('/ledger/balance', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getBalance));
    kernel.post('/ledger/transfer', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.transfer));
    kernel.get('/ledger/history', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getHistory));

    // --- Dashboard ---
    kernel.get('/dashboard/apps-i-use', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getAppsIUse));
    kernel.post('/dashboard/pin', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.togglePin));
    kernel.get('/registry', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.browseRegistry));

    // --- Listings (Monetization) ---
    kernel.post('/listings', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.createListing));
    kernel.get('/listings/mine', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getMyListings));
    kernel.get('/listings/:id', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.getListing));
    kernel.patch('/listings/:id', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.updateListing));
    kernel.post('/listings/:id/link-app', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.linkListingToApp));

    // --- Purchases ---
    kernel.post('/purchases/checkout', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.initiateCheckout));
    kernel.get('/purchases/mine', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getMyPurchases));
    kernel.post('/purchases/:id/refund', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.refundPurchase));

    // --- Payments (Seller accounts) ---
    kernel.post('/payments/connect', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.connectPayment));
    kernel.get('/payments/status', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.getPaymentStatus));
    kernel.post('/payments/webhook', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.handleWebhook));

    // --- Components ---
    kernel.post('/components', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.createComponent));
    kernel.get('/components', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.searchComponents));
    kernel.get('/components/:id', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.getComponent));
    kernel.patch('/components/:id', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.updateComponent));
    kernel.delete('/components/:id', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.deleteComponent));

    // --- Media ---
    kernel.post('/media', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.uploadMedia));
    kernel.get('/media/:key{.+}', setAuthLevel(AuthConfig.public), adaptController(KernelController, KernelController.serveMedia));
    kernel.delete('/media/:key{.+}', setAuthLevel(AuthConfig.authenticated), adaptController(KernelController, KernelController.deleteMedia));

    // Mount under /api/kernel
    app.route('/api/kernel', kernel);
}
