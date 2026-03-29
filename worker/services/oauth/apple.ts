/**
 * Apple Sign In OAuth Provider
 *
 * Apple Sign In differs from standard OAuth:
 * - client_secret is a JWT signed with your private key (ES256)
 * - User info comes from the id_token (JWT), not a userinfo endpoint
 * - Apple only sends user name on the FIRST authorization
 * - Callback can be a POST (form_post response mode) or GET
 *
 * Required env vars:
 *   APPLE_CLIENT_ID      - Service ID (e.g., com.jllly.signin)
 *   APPLE_TEAM_ID        - Apple Developer Team ID
 *   APPLE_KEY_ID         - Key ID for the Sign In private key
 *   APPLE_PRIVATE_KEY    - PEM-encoded ES256 private key (with \n line breaks)
 */

import { BaseOAuthProvider, OAuthTokens } from './base';
import type { OAuthUserInfo } from '../../types/auth-types';
import { OAuthProvider } from '../../types/auth-types';
import { createLogger } from '../../logger';

const logger = createLogger('AppleOAuth');

/**
 * Decode a JWT payload without verifying the signature.
 * Apple's id_token is verified by the token endpoint response itself.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
	const parts = jwt.split('.');
	if (parts.length !== 3) throw new Error('Invalid JWT');
	const payload = parts[1]
		.replace(/-/g, '+')
		.replace(/_/g, '/');
	const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
	return JSON.parse(atob(padded));
}

/**
 * Generate the Apple client_secret JWT (ES256, valid for up to 6 months).
 * Uses Web Crypto API (works on both CF Workers and Node.js 22+).
 */
async function generateAppleClientSecret(
	teamId: string,
	clientId: string,
	keyId: string,
	privateKeyPem: string,
): Promise<string> {
	// Import the PEM private key
	const pemBody = privateKeyPem
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		'pkcs8',
		keyData.buffer,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign'],
	);

	// Build JWT header + payload
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
	const payload = {
		iss: teamId,
		iat: now,
		exp: now + 86400 * 180, // 6 months
		aud: 'https://appleid.apple.com',
		sub: clientId,
	};

	const encode = (obj: Record<string, unknown>) =>
		btoa(JSON.stringify(obj))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');

	const signingInput = `${encode(header)}.${encode(payload)}`;
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		key,
		new TextEncoder().encode(signingInput),
	);

	// Convert DER-encoded signature to raw r||s
	const sigArray = new Uint8Array(sig);
	const sigBase64 = btoa(String.fromCharCode(...sigArray))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	return `${signingInput}.${sigBase64}`;
}

export class AppleOAuthProvider extends BaseOAuthProvider {
	protected readonly provider: OAuthProvider = 'apple';
	protected readonly authorizationUrl = 'https://appleid.apple.com/auth/authorize';
	protected readonly tokenUrl = 'https://appleid.apple.com/auth/token';
	protected readonly userInfoUrl = ''; // Apple uses id_token instead
	protected readonly scopes = ['name', 'email'];

	private teamId: string;
	private keyId: string;
	private privateKey: string;

	constructor(
		clientId: string,
		clientSecret: string, // Not used directly -- we generate JWT
		redirectUri: string,
		teamId: string,
		keyId: string,
		privateKey: string,
	) {
		super(clientId, clientSecret, redirectUri);
		this.teamId = teamId;
		this.keyId = keyId;
		this.privateKey = privateKey;
	}

	/**
	 * Override to add Apple-specific params (response_mode=form_post, response_type=code id_token)
	 */
	async getAuthorizationUrl(state: string, _codeVerifier?: string): Promise<string> {
		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			response_type: 'code',
			response_mode: 'query',
			scope: this.scopes.join(' '),
			state,
		});
		return `${this.authorizationUrl}?${params.toString()}`;
	}

	/**
	 * Override token exchange to use generated JWT as client_secret
	 */
	async exchangeCodeForTokens(code: string, _codeVerifier?: string): Promise<OAuthTokens> {
		const clientSecret = await generateAppleClientSecret(
			this.teamId,
			this.clientId,
			this.keyId,
			this.privateKey,
		);

		const params = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: this.clientId,
			client_secret: clientSecret,
			redirect_uri: this.redirectUri,
		});

		const response = await fetch(this.tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params.toString(),
		});

		if (!response.ok) {
			const error = await response.text();
			logger.error('Apple token exchange failed', { error });
			throw new Error(`Apple token exchange failed: ${error}`);
		}

		const data = await response.json() as {
			access_token: string;
			token_type: string;
			expires_in: number;
			refresh_token?: string;
			id_token: string;
		};

		return {
			accessToken: data.id_token, // Store id_token as accessToken for getUserInfo
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			tokenType: data.token_type || 'Bearer',
		};
	}

	/**
	 * Extract user info from Apple's id_token JWT
	 */
	async getUserInfo(idToken: string): Promise<OAuthUserInfo> {
		try {
			const claims = decodeJwtPayload(idToken) as {
				sub: string;
				email?: string;
				email_verified?: string | boolean;
				is_private_email?: string | boolean;
			};

			return {
				id: claims.sub,
				email: claims.email ?? '',
				name: undefined, // Apple only sends name on first auth (via POST body)
				picture: undefined,
				emailVerified: claims.email_verified === 'true' || claims.email_verified === true,
			};
		} catch (error) {
			logger.error('Failed to decode Apple id_token', { error });
			throw new Error('Failed to decode Apple id_token');
		}
	}

	static create(env: Env, baseUrl: string): AppleOAuthProvider {
		const e = env as Record<string, string>;
		if (!e.APPLE_CLIENT_ID || !e.APPLE_TEAM_ID || !e.APPLE_KEY_ID || !e.APPLE_PRIVATE_KEY) {
			throw new Error('Apple Sign In credentials not configured (need APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY)');
		}

		return new AppleOAuthProvider(
			e.APPLE_CLIENT_ID,
			'', // client_secret is generated per-request
			`${baseUrl}/api/auth/callback/apple`,
			e.APPLE_TEAM_ID,
			e.APPLE_KEY_ID,
			e.APPLE_PRIVATE_KEY,
		);
	}
}
