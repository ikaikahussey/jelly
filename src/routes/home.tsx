import { useRef, useState, useEffect, useMemo } from 'react';
import { ArrowRight, Info } from 'react-feather';
import { useNavigate } from 'react-router';
import { ProjectModeSelector, type ProjectModeOption } from '../components/project-mode-selector';
import { MAX_AGENT_QUERY_LENGTH, SUPPORTED_IMAGE_MIME_TYPES, type ProjectType } from '@/api-types';
import { useFeature } from '@/features';
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [projectMode, setProjectMode] = useState<ProjectType>('app');
	const [query, setQuery] = useState('');
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
			{/* Subtle dithered background */}
			<div className="fixed inset-0 z-0 pointer-events-none jelly-bg-pattern" />

			<LayoutGroup>
				<div className="w-full max-w-2xl overflow-hidden px-4">
					<motion.div
						layout
						transition={{ layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
						className={clsx(
							"flex flex-col items-center z-10",
							discoverReady ? "mt-24" : "mt-[14vh] sm:mt-[18vh] md:mt-[22vh]"
						)}>

						{/* === MAIN CARD (HyperCard stack) === */}
						<div className="w-full jelly-card animate-card-dissolve">
							{/* Title bar -- classic Mac window chrome */}
							<div className="jelly-titlebar flex items-center gap-2 rounded-t-md">
								<span className="jelly-close-box rounded-sm" />
								<span className="flex-1 text-center text-xs text-text-secondary tracking-wider select-none">
									Home
								</span>
								<span className="w-3" /> {/* spacer to balance close box */}
							</div>

							{/* Card body */}
							<div className="p-6 sm:p-8">
								{/* ASCII art logo */}
								<pre className="text-[5px] sm:text-[7px] md:text-[9px] leading-tight text-text-primary select-none mb-3 tracking-tighter text-center">
{ASCII_BANNER}
								</pre>

								<p className="text-center text-[10px] text-text-tertiary tracking-widest uppercase mb-6">
									-- build anything. connect everything. --
								</p>

								{/* Prompt heading */}
								<h1 className="text-text-primary font-medium leading-[1.1] tracking-tight text-xl sm:text-2xl w-full mb-4">
									What should we build today?
									<span className="inline-block w-2 h-4 bg-text-primary ml-1 animate-blink align-middle" />
								</h1>

								{/* Input field -- HyperCard scrolling field style */}
								<form
									method="POST"
									onSubmit={(e) => {
										e.preventDefault();
										const query = textareaRef.current!.value;
										handleCreateApp(query, projectMode);
									}}
									className="flex z-10 flex-col w-full min-h-[120px] jelly-field bg-bg-4 dark:bg-bg-2 p-4 transition-all duration-200"
								>
									<div
										className={clsx(
											"flex-1 flex flex-col relative",
											isDragging && "ring-2 ring-text-primary ring-offset-2 rounded"
										)}
										{...dragHandlers}
									>
										{isDragging && (
											<div className="absolute inset-0 flex items-center justify-center bg-text-primary/10 backdrop-blur-sm rounded z-30 pointer-events-none">
												<p className="text-text-primary font-medium">Drop files here</p>
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
											'flex items-center mt-3 pt-2 border-t border-border-tertiary',
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
												className="jelly-btn bg-bg-4 dark:bg-bg-2 text-text-primary px-3 py-1 text-sm transition-all duration-100 hover:bg-bg-2 active:jelly-btn-active disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
											>
												Build <ArrowRight className="size-3" />
											</button>
										</div>
									</div>
								</form>
							</div>

							{/* Card footer -- status bar */}
							<div className="flex justify-between text-[10px] text-text-tertiary border-t border-border-tertiary px-4 py-1.5 bg-bg-2 rounded-b-md">
								<span>Card 1 of 1</span>
								<span>visitor #{visitorCount.toLocaleString()}</span>
							</div>
						</div>
					</motion.div>
				</div>

				<AnimatePresence>
					{images.length > 0 && (
						<motion.div
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="w-full max-w-2xl px-4 mt-3"
						>
							<div className="jelly-panel flex items-start gap-2 px-4 py-3">
								<Info className="size-4 text-text-secondary flex-shrink-0 mt-0.5" />
								<p className="text-xs text-text-tertiary leading-relaxed">
									<span className="font-medium text-text-secondary">Note:</span> Images guide app layout and design but may not be replicated exactly.
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
							className={clsx('max-w-6xl mx-auto px-4 z-10', images.length > 0 ? 'mt-6' : 'mt-10 mb-8')}
						>
							{/* Discover section as its own HyperCard */}
							<div className="jelly-panel">
								<div className="jelly-titlebar flex items-center gap-2 rounded-t-md">
									<span className="jelly-close-box rounded-sm" />
									<span className="flex-1 text-center text-xs text-text-secondary tracking-wider select-none">
										Community Stacks
									</span>
									<button
										className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
										onClick={() => navigate('/discover')}
									>
										Browse All
									</button>
								</div>
								<div className="p-4">
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
								</div>
							</div>
						</motion.section>
					)}
				</AnimatePresence>
			</LayoutGroup>
		</div>
	);
}
