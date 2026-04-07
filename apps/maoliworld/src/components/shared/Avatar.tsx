import { media } from '@/lib/api-client';

interface AvatarProps {
    avatarKey: string | null;
    name: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZES = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-lg',
} as const;

export function Avatar({ avatarKey, name, size = 'md', className = '' }: AvatarProps) {
    const sizeClass = SIZES[size];
    const initials = (name ?? '?')
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    if (avatarKey) {
        return (
            <img
                src={media.url(avatarKey)}
                alt={name ?? 'Avatar'}
                className={`${sizeClass} rounded-full object-cover ${className}`}
            />
        );
    }

    return (
        <div
            className={`${sizeClass} rounded-full bg-koa-300 text-white flex items-center justify-center font-medium ${className}`}
        >
            {initials}
        </div>
    );
}
