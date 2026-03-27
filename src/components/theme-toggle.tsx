import { Moon, Sun, Monitor, Paintbrush } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useTheme } from '../contexts/theme-context';
import { useSkin } from '../contexts/skin-context';

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const { skin, setSkin } = useSkin();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-text-primary">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Mode
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Skin
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setSkin('hypercard')}>
          <Paintbrush className="mr-2 h-4 w-4" />
          <span>HyperCard</span>
          {skin === 'hypercard' && <span className="ml-auto text-xs text-text-tertiary">*</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSkin('helvetica')}>
          <Paintbrush className="mr-2 h-4 w-4" />
          <span>Helvetica</span>
          {skin === 'helvetica' && <span className="ml-auto text-xs text-text-tertiary">*</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
