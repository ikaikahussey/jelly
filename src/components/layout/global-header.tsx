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
					"sticky top-0 z-50 border-b-2 border-border-primary",
					pathname !== "/" && "bg-bg-3"
				)}
			>
				<div className="relative">
					<div className="relative z-10 flex items-center justify-between px-4 py-1.5">
						{/* Left: sidebar trigger + brand */}
						{user ? (
							<div className="flex items-center gap-3">
								<SidebarTrigger className="h-7 w-7 jelly-btn text-text-primary hover:jelly-btn-active transition-colors duration-150 flex items-center justify-center" />
								<span className="text-xs tracking-widest uppercase text-text-tertiary select-none hidden sm:inline">
									JLLLY
								</span>
								{hasMaintenanceMessage && (
									<button
										type="button"
										onClick={hasChangeLogs ? () => setIsChangelogOpen(true) : undefined}
										disabled={!hasChangeLogs}
										className={clsx(
											"flex items-center gap-1.5 jelly-btn px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:jelly-btn-active",
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
								JLLLY
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
				<DialogContent className="jelly-panel max-w-xl">
					<DialogHeader>
						<div className="jelly-titlebar flex items-center gap-2 rounded-t-md -mx-6 -mt-6 mb-4">
							<span className="jelly-close-box rounded-sm" />
							<DialogTitle className="flex-1 text-center text-xs tracking-wider select-none">
								Platform Updates
							</DialogTitle>
							<span className="w-3" />
						</div>
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
