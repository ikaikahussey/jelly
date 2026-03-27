import { SandboxSdkClient } from "./sandboxSdkClient";
import { RemoteSandboxServiceClient } from "./remoteSandboxService";
import { LocalSandboxService } from "./LocalSandboxService";
import { BaseSandboxService } from "./BaseSandboxService";

export function getSandboxService(sessionId: string, agentId: string, env?: Record<string, unknown>): BaseSandboxService {
    const runtime = env?.JELLY_RUNTIME as string | undefined;
    const serviceType = env?.SANDBOX_SERVICE_TYPE as string | undefined;

    // Local/Docker runtime: use local filesystem-based sandbox
    if (runtime === 'local' || runtime === 'docker') {
        console.log("[getSandboxService] Using local sandbox service");
        return new LocalSandboxService(sessionId, env);
    }

    if (serviceType === 'runner') {
        console.log("[getSandboxService] Using runner service for sandboxing");
        return new RemoteSandboxServiceClient(sessionId, env);
    }
    console.log("[getSandboxService] Using sandboxsdk service for sandboxing");
    return new SandboxSdkClient(sessionId, agentId, env);
}
