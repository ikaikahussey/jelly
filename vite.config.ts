// import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

import tailwindcss from '@tailwindcss/vite';

const isCloudflare = process.env.JELLY_RUNTIME !== 'local' && process.env.JELLY_RUNTIME !== 'docker';

// https://vite.dev/config/
export default defineConfig(async () => {
	const plugins = [
		react(),
		svgr(),
		tailwindcss(),
	];

	// Only include Cloudflare plugin when targeting CF runtime
	if (isCloudflare) {
		const { cloudflare } = await import('@cloudflare/vite-plugin');
		plugins.splice(2, 0, cloudflare({ configPath: 'wrangler.jsonc' }));
	}

	return {
	optimizeDeps: {
		exclude: ['format', 'editor.all'],
		include: ['monaco-editor/esm/vs/editor/editor.api'],
		force: true,
	},

	plugins,

	resolve: {
		alias: {
			debug: 'debug/src/browser',
			'@': path.resolve(__dirname, './src'),
			'shared': path.resolve(__dirname, './shared'),
			'worker': path.resolve(__dirname, './worker'),
		},
	},

	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'development',
		),
		global: 'globalThis',
		// '__filename': '""',
		// '__dirname': '""',
	},

	worker: {
		// Handle Prisma in worker context for development
		format: 'es',
	},

	server: {
		allowedHosts: true,
	},

	// Clear cache more aggressively
	cacheDir: 'node_modules/.vite',
};
});
