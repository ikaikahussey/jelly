import { Outlet } from 'react-router';
import { Navbar } from './Navbar';

export function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
                <Outlet />
            </main>
            <footer className="border-t border-koa-200 py-4 text-center text-sm text-koa-500">
                Maoliworld -- A community for Kanaka Maoli worldwide
            </footer>
        </div>
    );
}
