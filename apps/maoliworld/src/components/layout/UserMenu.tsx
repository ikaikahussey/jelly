import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { type KernelUser } from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';

interface UserMenuProps {
    user: KernelUser;
}

export function UserMenu({ user }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-koa-200 transition-shadow"
            >
                <Avatar
                    avatarKey={user.avatar_r2_key}
                    name={user.display_name}
                    size="sm"
                />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-koa-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-koa-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user.display_name ?? 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link
                        to={`/members/${user.user_id}`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-koa-50"
                        onClick={() => setOpen(false)}
                    >
                        My Profile
                    </Link>
                    <a
                        href="/api/auth/logout"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-koa-50"
                    >
                        Sign Out
                    </a>
                </div>
            )}
        </div>
    );
}
