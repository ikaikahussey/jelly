import { SandboxSdkClient } from "./sandboxSdkClient";
import { RemoteSandboxServiceClient } from "./remoteSandboxService";
import { BaseSandboxService } from "./BaseSandboxService";

export function getSandboxService(sessionId: string, agentId: string, env?: Record<string, unknown>): BaseSandboxService {
    const serviceType = env?.SANDBOX_SERVICE_TYPE;
    if (serviceType === 'runner') {
        console.log("[getSandboxService] Using runner service for sandboxing");
        return new RemoteSandboxServiceClient(sessionId, env);
    }
    console.log("[getSandboxService] Using sandboxsdk service for sandboxing");
    return new SandboxSdkClient(sessionId, agentId, env);
}