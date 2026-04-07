import { Link, useLocation } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { UserMenu } from './UserMenu';

const NAV_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/members', label: 'Members' },
    { to: '/forums', label: 'Forums' },
    { to: '/blogs', label: 'Blogs' },
    { to: '/photos', label: 'Photos' },
] as const;

export function Navbar() {
    const { user, loading } = useAuth();
    const location = useLocation();

    return (
        <header className="bg-white border-b border-koa-200 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
                <Link to="/" className="text-xl font-bold text-koa-800 tracking-tight">
                    Maoliworld
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {NAV_LINKS.map(({ to, label }) => {
                        const active = to === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(to);
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-koa-100 text-koa-900'
                                        : 'text-koa-600 hover:text-koa-900 hover:bg-koa-50'
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-3">
                    {loading ? (
                        <div className="w-8 h-8 rounded-full bg-koa-100 animate-pulse" />
                    ) : user ? (
                        <UserMenu user={user} />
                    ) : (
                        <a
                            href="/api/auth/login"
                            className="text-sm font-medium text-kai-700 hover:text-kai-800"
                        >
                            Sign In
                        </a>
                    )}
                </div>
            </div>

            {/* Mobile nav */}
            <nav className="md:hidden flex overflow-x-auto border-t border-koa-100 px-2">
                {NAV_LINKS.map(({ to, label }) => {
                    const active = to === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(to);
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={`px-3 py-2 text-sm whitespace-nowrap ${
                                active
                                    ? 'border-b-2 border-koa-700 text-koa-900 font-medium'
                                    : 'text-koa-500'
                            }`}
                        >
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
