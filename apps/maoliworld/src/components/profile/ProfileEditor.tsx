import { useState } from 'react';
import { auth, media, type KernelUser } from '@/lib/api-client';

interface ProfileEditorProps {
    user: KernelUser;
    onSaved: () => Promise<void>;
}

export function ProfileEditor({ user, onSaved }: ProfileEditorProps) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.display_name ?? '');
    const [bio, setBio] = useState((user.profile.bio as string) ?? '');
    const [location, setLocation] = useState((user.profile.location as string) ?? '');
    const [interests, setInterests] = useState((user.profile.interests as string) ?? '');
    const [saving, setSaving] = useState(false);

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="text-sm text-kai-600 hover:text-kai-800 font-medium"
            >
                Edit Profile
            </button>
        );
    }

    async function handleSave() {
        setSaving(true);
        try {
            await auth.updateProfile({
                display_name: displayName,
                profile: { bio, location, interests },
            });
            await onSaved();
            setEditing(false);
        } finally {
            setSaving(false);
        }
    }

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);
        try {
            const result = await media.upload(file);
            await auth.updateProfile({ avatar_r2_key: result.key });
            await onSaved();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="bg-white rounded-lg border border-koa-200 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-koa-700">Edit Profile</h3>

            <div>
                <label className="block text-xs text-koa-500 mb-1">Avatar</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="text-sm"
                />
            </div>

            <div>
                <label className="block text-xs text-koa-500 mb-1">Display Name</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300"
                />
            </div>

            <div>
                <label className="block text-xs text-koa-500 mb-1">Bio</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300 resize-y"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-koa-500 mb-1">Location</label>
                    <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300"
                    />
                </div>
                <div>
                    <label className="block text-xs text-koa-500 mb-1">Interests</label>
                    <input
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        className="w-full px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 text-sm text-koa-600 hover:text-koa-800"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
