import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getCORSConfig, getSecureHeadersConfig } from './config/security';
import { RateLimitService } from './services/rate-limit/rateLimits';
import { AppEnv } from './types/appenv';
import { setupRoutes } from './api/routes';
import { CsrfService } from './services/csrf/CsrfService';
import { SecurityError, SecurityErrorType } from 'shared/types/errors';
import { getGlobalConfigurableSettings } from './config';
import { AuthConfig, setAuthLevel } from './middleware/auth/routeAuth';
import { createInfraRegistry } from './infra/factory';
import type { InfraRegistry } from './infra/registry';
// import { initHonoSentry } from './observability/sentry';

export function createApp(env: Env, registry?: InfraRegistry): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    // Create infrastructure registry (if not provided externally)
    const infra = registry || createInfraRegistry(env as unknown as Record<string, unknown>);

    // Initialize CSRF service with env
    CsrfService.init(env as unknown as Record<string, unknown>);

    // Make infra registry available on all requests
    app.use('*', async (c, next) => {
        c.set('infra', infra);
        await next();
    });

    // Observability: Sentry error reporting & context
    // initHonoSentry(app);

    // Apply global security middlewares (skip for WebSocket upgrades)
    app.use('*', async (c, next) => {
        // Skip secure headers for WebSocket upgrade requests
        const upgradeHeader = c.req.header('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return next();
        }
        // Apply secure headers
        return secureHeaders(getSecureHeadersConfig(env))(c, next);
    });
    
    // CORS configuration
    app.use('/api/*', cors(getCORSConfig(env)));
    
    // CSRF protection using double-submit cookie pattern with proper GET handling
    app.use('*', async (c, next) => {
        const method = c.req.method.toUpperCase();
        
        // Skip for WebSocket upgrades
        const upgradeHeader = c.req.header('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return next();
        }
        
        try {
            // Handle GET requests - establish CSRF token if needed
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                await next();
                
                // Only set CSRF token for successful API responses
                if (c.req.url.startsWith('/api/') && c.res.status < 400) {
                    await CsrfService.enforce(c.req.raw, c.res);
                }
                
                return;
            }
            
            // Validate CSRF token for state-changing requests
            await CsrfService.enforce(c.req.raw, undefined);
            await next();
        } catch (error) {
            if (error instanceof SecurityError && error.type === SecurityErrorType.CSRF_VIOLATION) {
                return new Response(JSON.stringify({ 
                    error: { 
                        message: 'CSRF validation failed',
                        type: SecurityErrorType.CSRF_VIOLATION
                    }
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            throw error;
        }
    });

    app.use('/api/*', async (c, next) => {
        // Apply global config middleware
        const config = await getGlobalConfigurableSettings(env);
        c.set('config', config);

        // Apply global rate limit middleware (skip if DO bindings unavailable)
        try {
            await RateLimitService.enforceGlobalApiRateLimit(env, c.get('config').security.rateLimit, null, c.req.raw);
        } catch {
            // Rate limiting unavailable (e.g., no DO bindings on local runtime)
        }
        await next();
    })

    // By default, all routes require authentication
    app.use('/api/*', setAuthLevel(AuthConfig.ownerOnly));

    // Now setup all the routes
    setupRoutes(app);

    // Add not found route to redirect to ASSETS (CF) or serve static files (local)
    app.notFound(async (c) => {
        if (c.env.ASSETS?.fetch) {
            return c.env.ASSETS.fetch(c.req.raw);
        }
        // On non-CF runtimes, try to serve from dist/ directory
        try {
            const url = new URL(c.req.url);
            let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
            const { readFile } = await import('node:fs/promises');
            const { join, extname } = await import('node:path');
            const distDir = join(process.cwd(), 'dist');
            const fullPath = join(distDir, filePath);

            // Prevent directory traversal
            if (!fullPath.startsWith(distDir)) {
                return c.text('Forbidden', 403);
            }

            try {
                const data = await readFile(fullPath);
                const ext = extname(filePath);
                const mimeTypes: Record<string, string> = {
                    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
                    '.ico': 'image/x-icon', '.woff2': 'font/woff2',
                };
                return new Response(data, {
                    headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
                });
            } catch {
                // SPA fallback: serve index.html
                const indexData = await readFile(join(distDir, 'index.html'));
                return new Response(indexData, {
                    headers: { 'Content-Type': 'text/html' },
                });
            }
        } catch {
            return c.text('Not Found', 404);
        }
    });
    return app;
}