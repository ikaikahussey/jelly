import { CodingAgentController } from '../controllers/agent/controller';
import { AppEnv } from '../../types/appenv';
import { Hono } from 'hono';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import { adaptController } from '../honoAdapter';

/**
 * Setup and configure the application router
 */
export function setupCodegenRoutes(app: Hono<AppEnv>): void {
    // ========================================
    // CODE GENERATION ROUTES
    // ========================================
    
    // Create new app - authenticated users or anonymous guests
    app.post('/api/agent', setAuthLevel(AuthConfig.authenticatedOrAnonymous), adaptController(CodingAgentController, CodingAgentController.startCodeGeneration));

    // ========================================
    // APP EDITING ROUTES (/chat/:id frontend)
    // ========================================

    // WebSocket for app editing - owner or anonymous session owner, with ticket support
    app.get('/api/agent/:agentId/ws', setAuthLevel(AuthConfig.ownerOnlyOrAnonymous, {
        ticketAuth: { resourceType: 'agent', paramName: 'agentId' }
    }), adaptController(CodingAgentController, CodingAgentController.handleWebSocketConnection));

    // Connect to existing agent for editing - owner or anonymous session owner
    app.get('/api/agent/:agentId/connect', setAuthLevel(AuthConfig.ownerOnlyOrAnonymous), adaptController(CodingAgentController, CodingAgentController.connectToExistingAgent));

    app.get('/api/agent/:agentId/preview', setAuthLevel(AuthConfig.authenticated), adaptController(CodingAgentController, CodingAgentController.deployPreview));
}