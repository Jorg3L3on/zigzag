'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Ticket, User, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import {
  globalSearch,
  type GlobalSearchResult,
  type GlobalSearchResultType,
} from '@/actions/search';

const TYPE_META: Record<
  GlobalSearchResultType,
  { label: string; icon: typeof Ticket }
> = {
  ticket: { label: 'Tickets', icon: Ticket },
  client: { label: 'Clientes', icon: User },
  service: { label: 'Servicios', icon: Package },
};

const TYPE_ORDER: GlobalSearchResultType[] = ['ticket', 'client', 'service'];

export const GlobalSearch = () => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = window.setTimeout(async () => {
      const result = await globalSearch(trimmed);
      if (result.success) {
        setResults(result.data ?? []);
      }
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query, open]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: results.filter((row) => row.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        className="text-muted-foreground"
        aria-label="Buscar (Ctrl o Cmd + K)"
        tooltip="Buscar"
      >
        <Search className="size-4" aria-hidden  data-icon="inline-start" />
        <span className="group-data-[collapsible=icon]:hidden">Buscar…</span>
      </SidebarMenuButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
            <div className="flex items-center gap-2">
              <Search
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tickets, clientes o servicios…"
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                aria-label="Buscar"
              />
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Buscando…
              </p>
            ) : query.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres para buscar.
              </p>
            ) : grouped.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sin resultados para “{query.trim()}”.
              </p>
            ) : (
              grouped.map((group) => {
                const Icon = TYPE_META[group.type].icon;
                return (
                  <div key={group.type} className="mb-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {TYPE_META[group.type].label}
                    </p>
                    <ul>
                      {group.items.map((row) => (
                        <li key={`${row.type}-${row.id}`}>
                          <button
                            type="button"
                            onClick={() => handleSelect(row.href)}
                            className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted/60"
                          >
                            <Icon
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {row.title}
                              </span>
                              {row.subtitle ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {row.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
