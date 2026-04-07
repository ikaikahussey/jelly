/**
 * Ning Export Migration Script
 *
 * Reads a Ning JSON export directory and migrates data into the J3lli kernel:
 * - Creates user profiles via kernel identity system
 * - Creates groups, forums, blogs, photos, events as kernel content objects
 * - Rebuilds the social graph (friends, group memberships)
 * - Downloads and re-uploads photos/media to R2
 * - Outputs a migration report
 *
 * Usage: tsx scripts/migrate-ning.ts <export-dir> <api-base-url> [--dry-run]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
    NingMember,
    NingGroup,
    NingForumPost,
    NingBlogPost,
    NingPhoto,
    NingEvent,
    NingFriendship,
    NingExportData,
} from '../src/lib/ning-types';

// --- Config ---

interface MigrationConfig {
    exportDir: string;
    apiBase: string;
    dryRun: boolean;
    authToken: string;
}

interface MigrationReport {
    users: { total: number; created: number; skipped: number; errors: string[] };
    groups: { total: number; created: number; skipped: number; errors: string[] };
    forumPosts: { total: number; created: number; skipped: number; errors: string[] };
    blogPosts: { total: number; created: number; skipped: number; errors: string[] };
    photos: { total: number; created: number; downloaded: number; skipped: number; errors: string[] };
    events: { total: number; created: number; skipped: number; errors: string[] };
    friendships: { total: number; created: number; skipped: number; errors: string[] };
    groupMemberships: { total: number; created: number; errors: string[] };
}

// Maps Ning IDs to kernel IDs
const idMap = {
    users: new Map<string, string>(),
    groups: new Map<string, string>(),
    forumPosts: new Map<string, string>(),
    blogPosts: new Map<string, string>(),
};

// --- API helpers ---

async function kernelFetch(
    config: MigrationConfig,
    endpoint: string,
    init?: RequestInit
): Promise<Record<string, unknown>> {
    if (config.dryRun) {
        console.log(`  [DRY RUN] ${init?.method ?? 'GET'} ${endpoint}`);
        return { object_id: `dry-run-${Date.now()}`, user_id: `dry-run-${Date.now()}` };
    }

    const res = await fetch(`${config.apiBase}/api/kernel${endpoint}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Cookie: `jelly_session=${config.authToken}`,
            ...(init?.headers ?? {}),
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
    }

    return res.json() as Promise<Record<string, unknown>>;
}

async function uploadMedia(config: MigrationConfig, filePath: string): Promise<string> {
    if (config.dryRun) {
        console.log(`  [DRY RUN] Upload ${filePath}`);
        return `dry-run-key-${Date.now()}`;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    };
    const contentType = contentTypeMap[ext] ?? 'application/octet-stream';

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: contentType }), path.basename(filePath));

    const res = await fetch(`${config.apiBase}/api/kernel/media`, {
        method: 'POST',
        body: formData,
        headers: {
            Cookie: `jelly_session=${config.authToken}`,
        },
    });

    if (!res.ok) {
        throw new Error(`Media upload failed: ${res.status}`);
    }

    const result = await res.json() as { key: string };
    return result.key;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}

// --- Loaders ---

function loadJsonFile<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
}

function loadExportData(exportDir: string): NingExportData {
    const tryLoad = <T>(filename: string): T[] => {
        const filePath = path.join(exportDir, filename);
        if (fs.existsSync(filePath)) {
            return loadJsonFile<T[]>(filePath);
        }
        console.log(`  [SKIP] ${filename} not found, using empty array`);
        return [];
    };

    return {
        members: tryLoad<NingMember>('members.json'),
        groups: tryLoad<NingGroup>('groups.json'),
        forumPosts: tryLoad<NingForumPost>('forum_posts.json'),
        blogPosts: tryLoad<NingBlogPost>('blog_posts.json'),
        photos: tryLoad<NingPhoto>('photos.json'),
        events: tryLoad<NingEvent>('events.json'),
        friendships: tryLoad<NingFriendship>('friendships.json'),
    };
}

// --- Migration steps ---

async function migrateUsers(
    config: MigrationConfig,
    members: NingMember[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${members.length} members...`);
    report.users.total = members.length;

    for (const member of members) {
        try {
            if (member.state === 'banned') {
                report.users.skipped++;
                continue;
            }

            const profile: Record<string, string> = {
                bio: member.bio ?? '',
                location: member.location ?? '',
                ning_member_id: member.memberId,
                ...member.profileFields,
            };

            // Create profile object (user must already exist via OAuth or be created by admin)
            const result = await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'profile',
                    payload: {
                        display_name: member.fullName,
                        email: member.email,
                        avatar_url: member.avatarUrl,
                        location: member.location,
                        ...profile,
                    },
                    visibility: 'public',
                }),
            });

            idMap.users.set(member.memberId, result.object_id as string);
            report.users.created++;
        } catch (e) {
            report.users.errors.push(`${member.memberId}: ${(e as Error).message}`);
        }
    }
}

async function migrateGroups(
    config: MigrationConfig,
    groups: NingGroup[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${groups.length} groups...`);
    report.groups.total = groups.length;

    for (const group of groups) {
        try {
            const visibilityMap: Record<string, string> = {
                public: 'public',
                private: 'relationships',
                'invite-only': 'private',
            };

            const result = await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'group',
                    payload: {
                        name: group.name,
                        description: group.description,
                        privacy: group.privacy,
                        ning_group_id: group.groupId,
                    },
                    visibility: visibilityMap[group.privacy] ?? 'public',
                }),
            });

            const groupObjectId = result.object_id as string;
            idMap.groups.set(group.groupId, groupObjectId);
            report.groups.created++;

            // Create group memberships
            for (const memberId of group.members) {
                try {
                    const userObjectId = idMap.users.get(memberId);
                    if (!userObjectId) continue;

                    await kernelFetch(config, '/graph', {
                        method: 'POST',
                        body: JSON.stringify({
                            to_user: groupObjectId,
                            rel_type: 'member_of',
                            metadata: { role: memberId === group.createdBy ? 'admin' : 'member' },
                        }),
                    });
                    report.groupMemberships.created++;
                } catch (e) {
                    report.groupMemberships.errors.push(`${memberId}->${group.groupId}: ${(e as Error).message}`);
                }
            }
            report.groupMemberships.total += group.members.length;
        } catch (e) {
            report.groups.errors.push(`${group.groupId}: ${(e as Error).message}`);
        }
    }
}

async function migrateForumPosts(
    config: MigrationConfig,
    posts: NingForumPost[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${posts.length} forum posts...`);
    report.forumPosts.total = posts.length;

    for (const post of posts) {
        try {
            const parentId = post.groupId ? idMap.groups.get(post.groupId) : undefined;

            const result = await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'forum_post',
                    payload: {
                        title: post.title,
                        body: post.body,
                        ning_post_id: post.postId,
                        ning_author_id: post.authorId,
                    },
                    visibility: 'public',
                    parent_id: parentId,
                }),
            });

            const postObjectId = result.object_id as string;
            idMap.forumPosts.set(post.postId, postObjectId);
            report.forumPosts.created++;

            // Migrate replies as comments
            for (const reply of post.replies) {
                try {
                    await kernelFetch(config, '/objects', {
                        method: 'POST',
                        body: JSON.stringify({
                            type: 'comment',
                            payload: {
                                body: reply.body,
                                ning_reply_id: reply.replyId,
                                ning_author_id: reply.authorId,
                            },
                            visibility: 'public',
                            parent_id: postObjectId,
                        }),
                    });
                } catch (e) {
                    report.forumPosts.errors.push(`reply ${reply.replyId}: ${(e as Error).message}`);
                }
            }
        } catch (e) {
            report.forumPosts.errors.push(`${post.postId}: ${(e as Error).message}`);
        }
    }
}

async function migrateBlogPosts(
    config: MigrationConfig,
    posts: NingBlogPost[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${posts.length} blog posts...`);
    report.blogPosts.total = posts.length;

    for (const post of posts) {
        try {
            const result = await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'blog_post',
                    payload: {
                        title: post.title,
                        body: post.body,
                        ning_post_id: post.postId,
                        ning_author_id: post.authorId,
                    },
                    visibility: 'public',
                }),
            });

            const postObjectId = result.object_id as string;
            idMap.blogPosts.set(post.postId, postObjectId);
            report.blogPosts.created++;

            // Migrate comments
            for (const comment of post.comments) {
                try {
                    await kernelFetch(config, '/objects', {
                        method: 'POST',
                        body: JSON.stringify({
                            type: 'comment',
                            payload: {
                                body: comment.body,
                                ning_comment_id: comment.commentId,
                                ning_author_id: comment.authorId,
                            },
                            visibility: 'public',
                            parent_id: postObjectId,
                        }),
                    });
                } catch (e) {
                    report.blogPosts.errors.push(`comment ${comment.commentId}: ${(e as Error).message}`);
                }
            }
        } catch (e) {
            report.blogPosts.errors.push(`${post.postId}: ${(e as Error).message}`);
        }
    }
}

async function migratePhotos(
    config: MigrationConfig,
    photos: NingPhoto[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${photos.length} photos...`);
    report.photos.total = photos.length;

    const tmpDir = path.join(config.exportDir, '.tmp-photos');
    if (!config.dryRun && !fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    for (const photo of photos) {
        try {
            let mediaKey: string | undefined;

            if (photo.url) {
                const ext = path.extname(new URL(photo.url).pathname) || '.jpg';
                const tmpPath = path.join(tmpDir, `${photo.photoId}${ext}`);

                try {
                    if (!config.dryRun) {
                        await downloadFile(photo.url, tmpPath);
                        report.photos.downloaded++;
                    }
                    mediaKey = await uploadMedia(config, tmpPath);
                    if (!config.dryRun && fs.existsSync(tmpPath)) {
                        fs.unlinkSync(tmpPath);
                    }
                } catch (e) {
                    report.photos.errors.push(`download ${photo.photoId}: ${(e as Error).message}`);
                }
            }

            await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'photo',
                    payload: {
                        title: photo.title,
                        description: photo.description,
                        media_key: mediaKey,
                        original_url: photo.url,
                        album_name: photo.albumName,
                        tags: photo.tags,
                        ning_photo_id: photo.photoId,
                        ning_author_id: photo.authorId,
                    },
                    visibility: 'public',
                }),
            });

            report.photos.created++;
        } catch (e) {
            report.photos.errors.push(`${photo.photoId}: ${(e as Error).message}`);
        }
    }

    // Clean up tmp dir
    if (!config.dryRun && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

async function migrateEvents(
    config: MigrationConfig,
    events: NingEvent[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${events.length} events...`);
    report.events.total = events.length;

    for (const event of events) {
        try {
            await kernelFetch(config, '/objects', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'event',
                    payload: {
                        title: event.title,
                        description: event.description,
                        location: event.location,
                        start_date: event.startDate,
                        end_date: event.endDate,
                        attendees: event.attendees,
                        ning_event_id: event.eventId,
                        ning_created_by: event.createdBy,
                    },
                    visibility: 'public',
                }),
            });
            report.events.created++;
        } catch (e) {
            report.events.errors.push(`${event.eventId}: ${(e as Error).message}`);
        }
    }
}

async function migrateFriendships(
    config: MigrationConfig,
    friendships: NingFriendship[],
    report: MigrationReport
): Promise<void> {
    console.log(`\nMigrating ${friendships.length} friendships...`);
    report.friendships.total = friendships.length;

    for (const friendship of friendships) {
        try {
            await kernelFetch(config, '/graph', {
                method: 'POST',
                body: JSON.stringify({
                    to_user: friendship.friendId,
                    rel_type: 'friend',
                }),
            });
            report.friendships.created++;
        } catch (e) {
            report.friendships.errors.push(
                `${friendship.userId}->${friendship.friendId}: ${(e as Error).message}`
            );
        }
    }
}

// --- Report ---

function printReport(report: MigrationReport): void {
    console.log('\n========================================');
    console.log('  MIGRATION REPORT');
    console.log('========================================\n');

    const sections = [
        { name: 'Users', data: report.users },
        { name: 'Groups', data: report.groups },
        { name: 'Forum Posts', data: report.forumPosts },
        { name: 'Blog Posts', data: report.blogPosts },
        { name: 'Photos', data: report.photos },
        { name: 'Events', data: report.events },
        { name: 'Friendships', data: report.friendships },
        { name: 'Group Memberships', data: report.groupMemberships },
    ] as const;

    for (const section of sections) {
        const d = section.data;
        console.log(`${section.name}:`);
        console.log(`  Total: ${d.total}`);
        console.log(`  Created: ${d.created}`);
        if ('skipped' in d) console.log(`  Skipped: ${d.skipped}`);
        if ('downloaded' in d) console.log(`  Downloaded: ${d.downloaded}`);
        if (d.errors.length > 0) {
            console.log(`  Errors: ${d.errors.length}`);
            for (const err of d.errors.slice(0, 10)) {
                console.log(`    - ${err}`);
            }
            if (d.errors.length > 10) {
                console.log(`    ... and ${d.errors.length - 10} more`);
            }
        }
        console.log();
    }
}

// --- Main ---

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: tsx scripts/migrate-ning.ts <export-dir> <api-base-url> [--dry-run]');
        console.error('');
        console.error('Environment variables:');
        console.error('  JELLY_AUTH_TOKEN  - JWT auth token for kernel API calls');
        process.exit(1);
    }

    const config: MigrationConfig = {
        exportDir: path.resolve(args[0]!),
        apiBase: args[1]!.replace(/\/$/, ''),
        dryRun: args.includes('--dry-run'),
        authToken: process.env.JELLY_AUTH_TOKEN ?? '',
    };

    if (!config.authToken && !config.dryRun) {
        console.error('Error: JELLY_AUTH_TOKEN environment variable is required (unless --dry-run)');
        process.exit(1);
    }

    if (!fs.existsSync(config.exportDir)) {
        console.error(`Error: Export directory not found: ${config.exportDir}`);
        process.exit(1);
    }

    console.log(`Ning Migration Tool`);
    console.log(`  Export dir: ${config.exportDir}`);
    console.log(`  API base:   ${config.apiBase}`);
    console.log(`  Dry run:    ${config.dryRun}`);
    console.log();

    const data = loadExportData(config.exportDir);
    console.log(`Loaded export data:`);
    console.log(`  Members:      ${data.members.length}`);
    console.log(`  Groups:       ${data.groups.length}`);
    console.log(`  Forum posts:  ${data.forumPosts.length}`);
    console.log(`  Blog posts:   ${data.blogPosts.length}`);
    console.log(`  Photos:       ${data.photos.length}`);
    console.log(`  Events:       ${data.events.length}`);
    console.log(`  Friendships:  ${data.friendships.length}`);

    const report: MigrationReport = {
        users: { total: 0, created: 0, skipped: 0, errors: [] },
        groups: { total: 0, created: 0, skipped: 0, errors: [] },
        forumPosts: { total: 0, created: 0, skipped: 0, errors: [] },
        blogPosts: { total: 0, created: 0, skipped: 0, errors: [] },
        photos: { total: 0, created: 0, downloaded: 0, skipped: 0, errors: [] },
        events: { total: 0, created: 0, skipped: 0, errors: [] },
        friendships: { total: 0, created: 0, skipped: 0, errors: [] },
        groupMemberships: { total: 0, created: 0, errors: [] },
    };

    // Execute migration in dependency order
    await migrateUsers(config, data.members, report);
    await migrateGroups(config, data.groups, report);
    await migrateForumPosts(config, data.forumPosts, report);
    await migrateBlogPosts(config, data.blogPosts, report);
    await migratePhotos(config, data.photos, report);
    await migrateEvents(config, data.events, report);
    await migrateFriendships(config, data.friendships, report);

    printReport(report);

    // Write report to file
    const reportPath = path.join(config.exportDir, 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);
}

main().catch((e: unknown) => {
    console.error('Migration failed:', e);
    process.exit(1);
});
