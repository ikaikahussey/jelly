/**
 * Types for Ning JSON export data.
 * Ning 3.0 exports members, groups, forums, blogs, photos, and events
 * as JSON/CSV files in a directory archive.
 */

export interface NingMember {
    memberId: string;
    fullName: string;
    email: string;
    profileUrl: string;
    avatarUrl: string | null;
    joinDate: string;
    state: 'active' | 'suspended' | 'banned';
    profileFields: Record<string, string>;
    bio: string | null;
    location: string | null;
}

export interface NingGroup {
    groupId: string;
    name: string;
    description: string | null;
    privacy: 'public' | 'private' | 'invite-only';
    createdBy: string;
    createdDate: string;
    memberCount: number;
    members: string[];
}

export interface NingForumPost {
    postId: string;
    groupId: string | null;
    title: string;
    body: string;
    authorId: string;
    createdDate: string;
    replies: NingForumReply[];
}

export interface NingForumReply {
    replyId: string;
    body: string;
    authorId: string;
    createdDate: string;
}

export interface NingBlogPost {
    postId: string;
    title: string;
    body: string;
    authorId: string;
    createdDate: string;
    comments: NingComment[];
}

export interface NingComment {
    commentId: string;
    body: string;
    authorId: string;
    createdDate: string;
}

export interface NingPhoto {
    photoId: string;
    title: string | null;
    description: string | null;
    url: string;
    albumId: string | null;
    albumName: string | null;
    authorId: string;
    createdDate: string;
    tags: string[];
}

export interface NingEvent {
    eventId: string;
    title: string;
    description: string | null;
    location: string | null;
    startDate: string;
    endDate: string | null;
    createdBy: string;
    attendees: string[];
}

export interface NingFriendship {
    userId: string;
    friendId: string;
    createdDate: string;
}

export interface NingExportData {
    members: NingMember[];
    groups: NingGroup[];
    forumPosts: NingForumPost[];
    blogPosts: NingBlogPost[];
    photos: NingPhoto[];
    events: NingEvent[];
    friendships: NingFriendship[];
}
