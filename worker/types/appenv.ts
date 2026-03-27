import { GlobalConfigurableSettings } from "../config";
import { AuthLevelOptions, AuthRequirement } from "../middleware/auth/routeAuth";
import { AuthUser } from "./auth-types";
import type { InfraRegistry } from "../infra/registry";


export type AppEnv = {
    Bindings: Env;
    Variables: {
        user: AuthUser | null;
        sessionId: string | null;
        config: GlobalConfigurableSettings;
        authLevel: AuthRequirement;
        authLevelOptions?: AuthLevelOptions;
        infra?: InfraRegistry;
    }
}
