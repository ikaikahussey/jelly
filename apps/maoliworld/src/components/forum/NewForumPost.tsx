import { useState } from 'react';
import { objects } from '@/lib/api-client';
import { RichTextEditor } from '@/components/shared/RichTextEditor';

interface NewForumPostProps {
    onCreated: () => void;
    onCancel: () => void;
    parentId?: string;
}

export function NewForumPost({ onCreated, onCancel, parentId }: NewForumPostProps) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !body.trim()) return;

        setSubmitting(true);
        try {
            await objects.create({
                type: 'forum_post',
                payload: { title: title.trim(), body: body.trim() },
                visibility: 'public',
                parent_id: parentId,
            });
            onCreated();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-koa-200 p-4 space-y-4">
            <div>
                <label className="block text-xs text-koa-500 mb-1">Title</label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Discussion topic..."
                    className="w-full px-3 py-2 border border-koa-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-kai-300"
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-koa-500 mb-1">Body</label>
                <RichTextEditor
                    value={body}
                    onChange={setBody}
                    placeholder="Share your thoughts..."
                />
            </div>
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={submitting || !title.trim() || !body.trim()}
                    className="px-4 py-2 bg-koa-700 text-white text-sm font-medium rounded-lg hover:bg-koa-800 disabled:opacity-50 transition-colors"
                >
                    {submitting ? 'Posting...' : 'Post Discussion'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-koa-600 hover:text-koa-800"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
