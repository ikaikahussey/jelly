interface TimeAgoProps {
    timestamp: number;
    className?: string;
}

export function TimeAgo({ timestamp, className = '' }: TimeAgoProps) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    let label: string;
    if (seconds < 60) label = 'just now';
    else if (seconds < 3600) label = `${Math.floor(seconds / 60)}m ago`;
    else if (seconds < 86400) label = `${Math.floor(seconds / 3600)}h ago`;
    else if (seconds < 2592000) label = `${Math.floor(seconds / 86400)}d ago`;
    else label = new Date(timestamp).toLocaleDateString();

    return (
        <time
            dateTime={new Date(timestamp).toISOString()}
            className={`text-koa-400 ${className}`}
            title={new Date(timestamp).toLocaleString()}
        >
            {label}
        </time>
    );
}
