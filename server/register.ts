/**
 * Registration entry point for the CF shim loader.
 * Used with --import flag: tsx --import ./server/register.ts server/index.ts
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const loaderURL = new URL('./loader.ts', import.meta.url);
register(loaderURL.href, {
	parentURL: import.meta.url,
});
