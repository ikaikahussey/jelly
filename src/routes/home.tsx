import { useRef, useState, useEffect, useMemo } from 'react';
import { ArrowRight, Info } from 'react-feather';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/auth-context';
import { ProjectModeSelector, type ProjectModeOption } from '../components/project-mode-selector';
import { MAX_AGENT_QUERY_LENGTH, SUPPORTED_IMAGE_MIME_TYPES, type ProjectType } from '@/api-types';
import { useFeature } from '@/features';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { AppCard } from '@/components/shared/AppCard';
import clsx from 'clsx';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { ImageUploadButton } from '@/components/image-upload-button';
import { ImageAttachmentPreview } from '@/components/image-attachment-preview';
import { toast } from 'sonner';

// ASCII art banner
const ASCII_BANNER = `
     ██╗███████╗██╗     ██╗  ██╗   ██╗
     ██║██╔════╝██║     ██║  ╚██╗ ██╔╝
     ██║█████╗  ██║     ██║   ╚████╔╝
██   ██║██╔══╝  ██║     ██║    ╚██╔╝
╚█████╔╝███████╗███████╗███████╗██║
 ╚════╝ ╚══════╝╚══════╝╚══════╝╚═╝`.trim();

export default function Home() {
	const navigate = useNavigate();
	const { requireAuth } = useAuthGuard();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [projectMode, setProjectMode] = useState<ProjectType>('app');
	const [query, setQuery] = useState('');
	const { user } = useAuth();
	const { isLoadingCapabilities, capabilities, getEnabledFeatures } = useFeature();
	const [visitorCount] = useState(() => Math.floor(Math.random() * 9000) + 1000);

	const modeOptions = useMemo<ProjectModeOption[]>(() => {
		if (isLoadingCapabilities || !capabilities) return [];
		return getEnabledFeatures().map((def) => ({
			id: def.id,
			label:
				def.id === 'presentation'
					? 'Slides'
					: def.id === 'general'
						? 'General'
						: 'App',
			description: def.description,
		}));
	}, [capabilities, getEnabledFeatures, isLoadingCapabilities]);

	const showModeSelector = modeOptions.length > 1;

	useEffect(() => {
		if (isLoadingCapabilities) return;
		if (modeOptions.length === 0) {
			if (projectMode !== 'app') setProjectMode('app');
			return;
		}
		if (!modeOptions.some((m) => m.id === projectMode)) {
			setProjectMode(modeOptions[0].id);
		}
	}, [isLoadingCapabilities, modeOptions, projectMode]);

	const { images, addImages, removeImage, clearImages, isProcessing } = useImageUpload({
		onError: (error) => {
			console.error('Image upload error:', error);
			toast.error(error);
		},
	});

	const { isDragging, dragHandlers } = useDragDrop({
		onFilesDropped: addImages,
		accept: [...SUPPORTED_IMAGE_MIME_TYPES],
	});


	const placeholderPhrases = useMemo(() => [
		"todo list app",
		"F1 fantasy game",
		"personal finance tracker"
	], []);
	const [currentPlaceholderPhraseIndex, setCurrentPlaceholderPhraseIndex] = useState(0);
	const [currentPlaceholderText, setCurrentPlaceholderText] = useState("");
	const [isPlaceholderTyping, setIsPlaceholderTyping] = useState(true);

	const {
		apps,
		loading,
	} = usePaginatedApps({
		type: 'public',
		defaultSort: 'popular',
		defaultPeriod: 'week',
		limit: 6,
	});

	const discoverReady = useMemo(() => !loading && (apps?.length ?? 0) > 5, [loading, apps]);

	const handleCreateApp = (query: string, mode: ProjectType) => {
		if (query.length > MAX_AGENT_QUERY_LENGTH) {
			toast.error(
				`Prompt too large (${query.length} characters). Maximum allowed is ${MAX_AGENT_QUERY_LENGTH} characters.`,
			);
			return;
		}

		const encodedQuery = encodeURIComponent(query);
		const encodedMode = encodeURIComponent(mode);
		const imageParam = images.length > 0 ? `&images=${encodeURIComponent(JSON.stringify(images))}` : '';
		const intendedUrl = `/chat/new?query=${encodedQuery}&projectType=${encodedMode}${imageParam}`;

		if (
			!requireAuth({
				requireFullAuth: true,
				actionContext: 'to create applications',
				intendedUrl: intendedUrl,
			})
		) {
			return;
		}

		navigate(intendedUrl);
		clearImages();
	};

	const adjustTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			const scrollHeight = textareaRef.current.scrollHeight;
			const maxHeight = 300;
			textareaRef.current.style.height =
				Math.min(scrollHeight, maxHeight) + 'px';
		}
	};

	useEffect(() => {
		adjustTextareaHeight();
	}, []);

	// Typewriter effect
	useEffect(() => {
		const currentPhrase = placeholderPhrases[currentPlaceholderPhraseIndex];

		if (isPlaceholderTyping) {
			if (currentPlaceholderText.length < currentPhrase.length) {
				const timeout = setTimeout(() => {
					setCurrentPlaceholderText(currentPhrase.slice(0, currentPlaceholderText.length + 1));
				}, 100);
				return () => clearTimeout(timeout);
			} else {
				const timeout = setTimeout(() => {
					setIsPlaceholderTyping(false);
				}, 2000);
				return () => clearTimeout(timeout);
			}
		} else {
			if (currentPlaceholderText.length > 0) {
				const timeout = setTimeout(() => {
					setCurrentPlaceholderText(currentPlaceholderText.slice(0, -1));
				}, 50);
				return () => clearTimeout(timeout);
			} else {
				setCurrentPlaceholderPhraseIndex((prev) => (prev + 1) % placeholderPhrases.length);
				setIsPlaceholderTyping(true);
			}
		}
	}, [currentPlaceholderText, currentPlaceholderPhraseIndex, isPlaceholderTyping, placeholderPhrases]);

	return (
		<div className="relative flex flex-col items-center size-full">
			{/* Dithered dot pattern background */}
			<div className="fixed inset-0 z-0 opacity-30 pointer-events-none bg-dots text-text-tertiary" />

			{/* Scanline overlay */}
			<div className="fixed inset-0 z-0 pointer-events-none opacity-[0.02]"
				style={{
					background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
				}}
			/>

			<LayoutGroup>
				<div className="w-full max-w-2xl overflow-hidden">
					<motion.div
						layout
						transition={{ layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
						className={clsx(
							"px-6 p-8 flex flex-col items-center z-10",
							discoverReady ? "mt-32" : "mt-[16vh] sm:mt-[20vh] md:mt-[24vh]"
						)}>

						{/* ASCII art logo */}
						<pre className="text-[6px] sm:text-[8px] md:text-[10px] leading-tight text-text-primary select-none mb-2 tracking-tighter">
							{ASCII_BANNER}
						</pre>

						{/* Tagline */}
						<div className="text-center mb-6">
							<p className="text-xs text-text-tertiary tracking-widest uppercase">
								-- build anything. connect everything. --
							</p>
							<p className="text-[10px] text-text-tertiary mt-1">
								visitor #{visitorCount.toLocaleString()} | est. 2024
							</p>
						</div>

						{/* Horizontal rule -- Geocities style */}
						<div className="w-full mb-6 border-t border-dashed border-text-tertiary" />

						<h1 className="text-text-primary font-medium leading-[1.1] tracking-tight text-2xl sm:text-3xl w-full mb-4">
							&gt; What should we build today?
							<span className="inline-block w-2 h-5 bg-text-primary ml-1 animate-blink align-middle" />
						</h1>

						<form
							method="POST"
							onSubmit={(e) => {
								e.preventDefault();
								const query = textareaRef.current!.value;
								handleCreateApp(query, projectMode);
							}}
							className="flex z-10 flex-col w-full min-h-[150px] bg-bg-4 border-2 border-text-primary dark:bg-bg-2 shadow-textarea p-5 transition-all duration-200"
						>
							<div
								className={clsx(
									"flex-1 flex flex-col relative",
									isDragging && "ring-2 ring-text-primary ring-offset-2"
								)}
								{...dragHandlers}
							>
								{isDragging && (
									<div className="absolute inset-0 flex items-center justify-center bg-text-primary/10 backdrop-blur-sm z-30 pointer-events-none">
										<p className="text-text-primary font-medium">&gt; drop_files_here</p>
									</div>
								)}
								<textarea
									className="w-full resize-none ring-0 z-20 outline-0 placeholder:text-text-tertiary text-text-primary bg-transparent"
									name="query"
									value={query}
									placeholder={`Create a ${currentPlaceholderText}`}
									ref={textareaRef}
									onChange={(e) => {
										setQuery(e.target.value);
										adjustTextareaHeight();
									}}
									onInput={adjustTextareaHeight}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											const query = textareaRef.current!.value;
											handleCreateApp(query, projectMode);
										}
									}}
								/>
								{images.length > 0 && (
									<div className="mt-3">
										<ImageAttachmentPreview
											images={images}
											onRemove={removeImage}
										/>
									</div>
								)}
							</div>
							<div
								className={clsx(
									'flex items-center mt-4 pt-1 border-t border-dashed border-text-tertiary/30',
									showModeSelector ? 'justify-between' : 'justify-end',
								)}
							>
								{showModeSelector && (
									<ProjectModeSelector
										value={projectMode}
										onChange={setProjectMode}
										modes={modeOptions}
										className="flex-1"
									/>
								)}

								<div className={clsx('flex items-center gap-2', showModeSelector && 'ml-4')}>
									<ImageUploadButton
										onFilesSelected={addImages}
										disabled={isProcessing}
									/>
									<button
										type="submit"
										disabled={!query.trim()}
										className="bg-text-primary text-text-inverted p-1 *:size-5 transition-all duration-200 hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed border border-text-primary"
									>
										<ArrowRight />
									</button>
								</div>
							</div>
						</form>

						{/* "Guestbook" style status bar */}
						<div className="w-full mt-3 flex justify-between text-[10px] text-text-tertiary border border-dashed border-text-tertiary/30 px-3 py-1.5">
							<span>STATUS: ONLINE</span>
							<span>|</span>
							<span>BEST VIEWED AT ANY RESOLUTION</span>
							<span>|</span>
							<span>MADE WITH {"<3"}</span>
						</div>
					</motion.div>
				</div>

				<AnimatePresence>
					{images.length > 0 && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="w-full max-w-2xl px-6"
						>
							<div className="flex items-start gap-2 px-4 py-3 bg-bg-4/50 dark:bg-bg-2/50 border border-dashed border-text-tertiary">
								<Info className="size-4 text-text-secondary flex-shrink-0 mt-0.5" />
								<p className="text-xs text-text-tertiary leading-relaxed">
									<span className="font-medium text-text-secondary">[BETA]</span> Images guide app layout and design but may not be replicated exactly.
								</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<AnimatePresence>
					{discoverReady && (
						<motion.section
							key="discover-section"
							layout
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
							className={clsx('max-w-6xl mx-auto px-4 z-10', images.length > 0 ? 'mt-10' : 'mt-12 mb-8')}
						>
							<div className='flex flex-col items-start'>
								{/* Section header -- retro divider */}
								<div className="w-full border-t border-dashed border-text-tertiary mb-4" />
								<div className="flex w-full items-baseline justify-between mb-4">
									<h2 className="text-lg tracking-widest uppercase text-text-secondary">
										// community_builds
									</h2>
									<button
										className="text-xs text-text-tertiary hover:text-text-primary underline underline-offset-4 transition-colors"
										onClick={() => navigate('/discover')}
									>
										[view all]
									</button>
								</div>
								<motion.div
									layout
									transition={{ duration: 0.4 }}
									className="grid grid-cols-2 xl:grid-cols-3 gap-4"
								>
									<AnimatePresence mode="popLayout">
										{apps.map(app => (
											<AppCard
												key={app.id}
												app={app}
												onClick={() => navigate(`/app/${app.id}`)}
												showStats={true}
												showUser={true}
												showActions={false}
											/>
										))}
									</AnimatePresence>
								</motion.div>
								<div className="w-full border-b border-dashed border-text-tertiary mt-6" />
							</div>
						</motion.section>
					)}
				</AnimatePresence>
			</LayoutGroup>
		</div>
	);
}
