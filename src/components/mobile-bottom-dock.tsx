'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import { MoreHorizontal, Plus, type LucideIcon } from 'lucide-react';

import {
  GLASS_MENU_ICON_PILL_CLASS,
  GLASS_MENU_ITEM_CLASS,
  GLASS_MENU_PANEL_CLASS,
  TOOLBAR_GLASS_ICON,
} from '@/components/toolbar-glass';
import { useSidebar } from '@/components/ui/sidebar';
import { useMobileChrome } from '@/contexts/mobile-chrome-context';
import { usePermissions } from '@/hooks/use-permissions';
import {
  getActiveMobileTabHref,
  MOBILE_CREATE_ACTIONS,
  MOBILE_DOCK_CREATE_SLOT,
  MOBILE_TAB_ITEMS,
} from '@/lib/nav-items';
import { DOCK_FLOAT_PADDING_CLASS } from '@/lib/ui/dock-clearance';
import { cn } from '@/lib/utils';

const PILL_SPRING: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
};

const MENU_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.7,
};

const INSTANT: Transition = { duration: 0 };

export const MOBILE_DOCK_SHELL_CLASS = cn(
  'relative grid h-(--dock-bar-height) items-center rounded-full px-1',
  'border border-black/10 bg-background/70 shadow-panel',
  'supports-[backdrop-filter]:bg-background/45 backdrop-blur-2xl backdrop-saturate-180',
  'dark:border-white/[0.12] dark:bg-[rgb(9_14_29/0.6)] dark:supports-[backdrop-filter]:bg-[rgb(9_14_29/0.4)]',
  'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-black/20 before:to-transparent',
  'dark:before:via-white/40',
);

const DOCK_ITEM_CLASS =
  'relative z-0 flex h-14 min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50';
const DOCK_ITEM_ACTIVE_CLASS = 'text-foreground';
const DOCK_ITEM_IDLE_CLASS = 'text-muted-foreground hover:text-foreground';

type DockPillProps = {
  layoutId: string;
  reduceMotion: boolean | null;
};

/** Sliding glass pill behind the active slot (shared layoutId springs between tabs). */
const DockPill = ({ layoutId, reduceMotion }: DockPillProps) => (
  <motion.span
    layoutId={layoutId}
    data-testid="mobile-dock-pill"
    className="liquid-glass liquid-glass-pill absolute inset-1 -z-10 rounded-full"
    transition={reduceMotion ? INSTANT : PILL_SPRING}
    aria-hidden
  />
);

type DockLabelProps = {
  icon: LucideIcon;
  title: string;
  active: boolean;
};

const DockLabel = ({ icon: Icon, title, active }: DockLabelProps) => (
  <>
    <Icon className="h-5 w-5 shrink-0" aria-hidden />
    <span
      className={cn(
        'max-w-full truncate text-center leading-tight tracking-tight transition-opacity',
        active ? 'opacity-100' : 'opacity-60',
      )}
    >
      {title}
    </span>
  </>
);

/**
 * Floating liquid-glass dock (ported from Micasa / Filmia):
 * Hoy · Tickets · + · Clientes · Más, sliding pill on the active slot,
 * center + opens the quick-create glass menu above the dock.
 */
export const MobileBottomDock = () => {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { setOpenMobile } = useSidebar();
  const { hasStickyAction } = useMobileChrome();
  const reduceMotion = useReducedMotion();
  const pillLayoutId = useId();
  const menuId = useId();
  // Menu belongs to the route it was opened on, so navigation closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  const visibleTabs = MOBILE_TAB_ITEMS.filter((item) =>
    can(item.requiredPermission),
  );
  const createActions = MOBILE_CREATE_ACTIONS.filter((action) =>
    can(action.requiredPermission),
  );
  const showCreate = createActions.length > 0;
  const activeHref = getActiveMobileTabHref(pathname, visibleTabs);
  const moreActive = activeHref === null;
  // The + sits between Tickets and Clientes; with fewer visible tabs it stays centered-ish.
  const createSlot = Math.min(MOBILE_DOCK_CREATE_SLOT, visibleTabs.length);
  const columnCount = visibleTabs.length + 1 + (showCreate ? 1 : 0);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (plusRef.current?.contains(target)) return;
      setMenuOpenOn(null);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpenOn(null);
        plusRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (hasStickyAction) {
    return null;
  }

  const handleToggleMenu = () => {
    setMenuOpenOn(menuOpen ? null : pathname);
  };

  const handleOpenMore = () => {
    setMenuOpenOn(null);
    setOpenMobile(true);
  };

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenMore();
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  };

  const tabNodes = visibleTabs.map((item) => {
    const active = activeHref === item.url;
    return (
      <motion.div
        key={item.url}
        className="relative isolate flex min-w-0"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      >
        <Link
          href={item.url}
          aria-current={active ? 'page' : undefined}
          aria-label={item.title}
          className={cn(
            DOCK_ITEM_CLASS,
            active ? DOCK_ITEM_ACTIVE_CLASS : DOCK_ITEM_IDLE_CLASS,
          )}
        >
          {active ? (
            <DockPill layoutId={pillLayoutId} reduceMotion={reduceMotion} />
          ) : null}
          {item.icon ? (
            <DockLabel icon={item.icon} title={item.title} active={active} />
          ) : (
            item.title
          )}
        </Link>
      </motion.div>
    );
  });

  const createNode = showCreate ? (
    <div key="create" className="relative flex min-w-0 items-center justify-center">
      <motion.button
        ref={plusRef}
        type="button"
        data-testid="mobile-dock-create"
        aria-label={menuOpen ? 'Cerrar menú crear' : 'Crear'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={handleToggleMenu}
        whileTap={reduceMotion ? undefined : { scale: 0.9 }}
        className={cn(
          TOOLBAR_GLASS_ICON,
          'flex size-12 items-center justify-center active:scale-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
      >
        <motion.span
          animate={{ rotate: menuOpen ? 45 : 0 }}
          transition={reduceMotion ? INSTANT : PILL_SPRING}
          className="flex"
        >
          <Plus className="size-6" aria-hidden />
        </motion.span>
      </motion.button>
    </div>
  ) : null;

  const slots = [
    ...tabNodes.slice(0, createSlot),
    createNode,
    ...tabNodes.slice(createSlot),
  ];

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="mobile-bottom-tab-bar"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 md:hidden',
        DOCK_FLOAT_PADDING_CLASS,
      )}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Crear"
              onKeyDown={handleMenuKeyDown}
              initial={
                reduceMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.92, y: 8 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.92, y: 8 }
              }
              transition={reduceMotion ? INSTANT : MENU_TRANSITION}
              style={{ transformOrigin: 'bottom center' }}
              className={cn(
                'absolute bottom-[calc(100%+0.75rem)] left-1/2 z-10 w-[min(17.5rem,calc(100vw-1.5rem))] -translate-x-1/2',
                GLASS_MENU_PANEL_CLASS,
              )}
            >
              {createActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.url}
                    href={action.url}
                    role="menuitem"
                    onClick={() => setMenuOpenOn(null)}
                    className={GLASS_MENU_ITEM_CLASS}
                  >
                    <span className={GLASS_MENU_ICON_PILL_CLASS}>
                      <Icon aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {action.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {action.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          data-testid="mobile-dock-shell"
          className={MOBILE_DOCK_SHELL_CLASS}
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {slots}
          <motion.div
            className="relative isolate flex min-w-0"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <button
              type="button"
              aria-label="Más opciones de navegación"
              onClick={handleOpenMore}
              onKeyDown={handleMoreKeyDown}
              className={cn(
                DOCK_ITEM_CLASS,
                moreActive ? DOCK_ITEM_ACTIVE_CLASS : DOCK_ITEM_IDLE_CLASS,
              )}
            >
              {moreActive ? (
                <DockPill layoutId={pillLayoutId} reduceMotion={reduceMotion} />
              ) : null}
              <DockLabel icon={MoreHorizontal} title="Más" active={moreActive} />
            </button>
          </motion.div>
        </div>
      </div>
    </nav>
  );
};
