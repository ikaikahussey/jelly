import { useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AuthButton } from '../auth/auth-button';
import { ThemeToggle } from '../theme-toggle';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { AlertCircle } from 'lucide-react';
import { usePlatformStatus } from '@/hooks/use-platform-status';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation } from 'react-router';
import clsx from 'clsx';

export function GlobalHeader() {
	const { user } = useAuth();
	const { status } = usePlatformStatus();
	const [isChangelogOpen, setIsChangelogOpen] = useState(false);
	const hasMaintenanceMessage = Boolean(status.hasActiveMessage && status.globalUserMessage.trim().length > 0);
	const hasChangeLogs = Boolean(status.changeLogs && status.changeLogs.trim().length > 0);
	const { pathname } = useLocation();

	useEffect(() => {
		if (!hasChangeLogs) {
			setIsChangelogOpen(false);
		}
	}, [hasChangeLogs]);

	return (
		<Dialog open={isChangelogOpen} onOpenChange={setIsChangelogOpen}>
			<motion.header
				initial={{ y: -10, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.2, ease: 'easeOut' }}
				className={clsx(
					"sticky top-0 z-50 border-b border-dashed",
					pathname !== "/" && "bg-bg-3"
				)}
			>
				<div className="relative">
					<div className="relative z-10 flex items-center justify-between px-4 py-1.5">
						{/* Left: sidebar trigger + brand */}
						{user ? (
							<div className="flex items-center gap-3">
								<SidebarTrigger className="h-7 w-7 text-text-primary hover:bg-bg-2 transition-colors duration-150" />
								<span className="text-xs tracking-widest uppercase text-text-tertiary select-none hidden sm:inline">
									JELLY.SH
								</span>
								{hasMaintenanceMessage && (
									<button
										type="button"
										onClick={hasChangeLogs ? () => setIsChangelogOpen(true) : undefined}
										disabled={!hasChangeLogs}
										className={clsx(
											"flex items-center gap-1.5 border border-dashed px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:bg-bg-2",
											!hasChangeLogs && "opacity-50 cursor-not-allowed pointer-events-none"
										)}
									>
										<AlertCircle className="h-3 w-3" />
										<span className="truncate max-w-[30ch] md:max-w-[50ch]">{status.globalUserMessage}</span>
									</button>
								)}
							</div>
						) : (
							<span className="text-xs tracking-widest uppercase text-text-tertiary select-none">
								JELLY.SH
							</span>
						)}

						{/* Right: controls */}
						<div className="flex items-center gap-2">
							<ThemeToggle />
							<AuthButton />
						</div>
					</div>
				</div>
			</motion.header>
			{hasChangeLogs && (
				<DialogContent className="max-w-xl border-2">
					<DialogHeader>
						<DialogTitle className="tracking-widest uppercase text-sm">
							// platform_updates
						</DialogTitle>
						{status.globalUserMessage && (
							<DialogDescription className="text-xs text-text-tertiary">
								{status.globalUserMessage}
							</DialogDescription>
						)}
					</DialogHeader>
					<ScrollArea className="max-h-[60vh] pr-4">
						<pre className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
							{status.changeLogs}
						</pre>
					</ScrollArea>
				</DialogContent>
			)}
		</Dialog>
	);
}
