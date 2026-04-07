import { useState } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minRows?: number;
}

export function RichTextEditor({ value, onChange, placeholder, minRows = 4 }: RichTextEditorProps) {
    const [preview, setPreview] = useState(false);

    return (
        <div className="border border-koa-200 rounded-lg overflow-hidden">
            <div className="flex border-b border-koa-100 bg-koa-50 px-2 py-1 gap-1">
                <button
                    type="button"
                    onClick={() => setPreview(false)}
                    className={`px-2 py-1 text-xs rounded ${
                        !preview ? 'bg-white shadow-sm text-koa-800' : 'text-koa-500'
                    }`}
                >
                    Write
                </button>
                <button
                    type="button"
                    onClick={() => setPreview(true)}
                    className={`px-2 py-1 text-xs rounded ${
                        preview ? 'bg-white shadow-sm text-koa-800' : 'text-koa-500'
                    }`}
                >
                    Preview
                </button>
            </div>

            {preview ? (
                <div
                    className="p-3 prose prose-sm max-w-none min-h-[100px]"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
                />
            ) : (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={minRows}
                    className="w-full p-3 text-sm resize-y focus:outline-none"
                />
            )}
        </div>
    );
}

/**
 * Minimal Markdown-to-HTML for preview.
 * Handles paragraphs, bold, italic, links, and line breaks.
 */
function markdownToHtml(md: string): string {
    return md
        .split('\n\n')
        .map(block => {
            const html = block
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-kai-600 underline">$1</a>')
                .replace(/\n/g, '<br/>');
            return `<p>${html}</p>`;
        })
        .join('');
}
