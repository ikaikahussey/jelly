/**
 * @jllly/platform - Platform SDK for JLLLY generated apps
 *
 * Usage:
 *   import { platform } from '@jllly/platform';
 *   const user = await platform.auth.requireUser();
 *   const posts = await platform.objects.query({ type: 'post', owner: user.user_id });
 */

import { AuthClient } from './auth';
import { GraphClient } from './graph';
import { ObjectsClient } from './objects';
import { LedgerClient } from './ledger';
import { MarketplaceClient } from './marketplace';

export type { User, Visibility, Relationship, PlatformObject, LedgerEntry } from './types';
export type { Listing, Purchase, Component } from './marketplace';

export const platform = {
    auth: new AuthClient(),
    graph: new GraphClient(),
    objects: new ObjectsClient(),
    ledger: new LedgerClient(),
    marketplace: new MarketplaceClient(),
};
