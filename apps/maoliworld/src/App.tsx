import { Routes, Route } from 'react-router';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/routes/HomePage';
import { ProfilePage } from '@/routes/ProfilePage';
import { ForumsPage } from '@/routes/ForumsPage';
import { ForumThreadPage } from '@/routes/ForumThreadPage';
import { BlogsPage } from '@/routes/BlogsPage';
import { BlogPostPage } from '@/routes/BlogPostPage';
import { PhotosPage } from '@/routes/PhotosPage';
import { MembersPage } from '@/routes/MembersPage';

export function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/:userId" element={<ProfilePage />} />
                <Route path="forums" element={<ForumsPage />} />
                <Route path="forums/:postId" element={<ForumThreadPage />} />
                <Route path="blogs" element={<BlogsPage />} />
                <Route path="blogs/:postId" element={<BlogPostPage />} />
                <Route path="photos" element={<PhotosPage />} />
            </Route>
        </Routes>
    );
}
