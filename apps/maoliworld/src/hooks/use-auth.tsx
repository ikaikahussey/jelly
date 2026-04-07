import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { auth, type KernelUser } from '@/lib/api-client';

interface AuthState {
    user: KernelUser | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    user: null,
    loading: true,
    refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<KernelUser | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const me = await auth.getMe();
            setUser(me);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <AuthContext.Provider value={{ user, loading, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    return useContext(AuthContext);
}
