import { useLocaleSwitch, useT } from '@dec/i18n/react';
import { messages } from '../../i18n/index.ts';
import type { Locale } from '@dec/i18n';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { Bell, ChevronDown, Languages, LayoutGrid, Moon, RefreshCw, Search, Sun, Monitor, Maximize2, Minus, X } from 'lucide-react';
import {
  CommandPalette,
  DropdownMenu,
  Popover,
  Tooltip,
  formatShortcut,
  useTheme,
  type CommandItem,
} from '@dec/ui';
import { ROUTES, type AppRoute } from '../../app/routes.ts';
import { platform, desktopWindow, titleBarHandlers } from '../../platform/desktop.ts';
import { isBareKey, matchesAction, useShortcuts } from '../shortcuts/store.ts';
import { selectRealtime, useMonitoring } from '../../pages/home/monitoring/store.ts';
import { BrandMark } from './BrandMark.tsx';
import { NavTabs } from './NavTabs.tsx';
import { WindowControls } from './WindowControls.tsx';
import { NotificationList } from '../notifications/NotificationList.tsx';
import { markAllRead, useUnreadCount } from '../notifications/store.ts';
import './titlebar.css';

const NO_DRAG = 'button, a, input, select, textarea, [role="button"], [role="tab"], [data-no-drag], [contenteditable="true"]';
const { onPointerDown, onDoubleClick } = titleBarHandlers(NO_DRAG);
const dragHandlers = { onPointerDown, onDoubleClick };
const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

interface TitleBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOverview: () => void;
}

export function TitleBar({ activeRoute, onNavigate, onOverview }: TitleBarProps) {
  const desktop = platform === 'desktop';
  const { theme, setTheme, toggleTheme } = useTheme();
  const networkOnline = useOnline();
  const realtime = useMonitoring(selectRealtime);
  const online = networkOnline && realtime !== 'disconnected';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { locale, setLocale } = useLocaleSwitch();
  const t = useT(messages);
  const notificationCount = useUnreadCount();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const toggleNotifications = (open: boolean) => {
    if (!open && notificationsOpen) markAllRead();
    setNotificationsOpen(open);
  };
  const [endRef, endWidth] = useWidth<HTMLDivElement>();
  const shortcuts = useShortcuts();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editable = !!target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName));
      const blocked = (id: string) => editable && isBareKey(shortcuts[id] ?? '');
      if (matchesAction(e, 'palette') && !blocked('palette')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const route = ROUTES.find((r) => matchesAction(e, r.id) && !blocked(r.id));
      if (!route) return;
      e.preventDefault();
      onNavigate(route);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, shortcuts]);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = ROUTES.map((r) => {
      const Icon = r.icon;
      return {
        id: `go-${r.id}`,
        label: t(r.labelKey),
        description: t(r.descriptionKey),
        group: t('shell.commands.groupNavigate'),
        icon: <Icon size={15} />,
        shortcut: shortcuts[r.id],
        onRun: () => onNavigate(r),
      };
    });
    items.push(
      { id: 'overview', label: t('shell.overview.label'), description: t('shell.overview.description'), group: t('shell.commands.groupNavigate'), icon: <LayoutGrid size={15} />, shortcut: shortcuts.overview, onRun: onOverview },
      { id: 'theme-dark', label: t('shell.commands.darkTheme'), group: t('shell.commands.groupAppearance'), icon: <Moon size={15} />, onRun: () => setTheme('dark') },
      { id: 'theme-light', label: t('shell.commands.lightTheme'), group: t('shell.commands.groupAppearance'), icon: <Sun size={15} />, onRun: () => setTheme('light') },
      { id: 'theme-system', label: t('shell.commands.systemTheme'), group: t('shell.commands.groupAppearance'), icon: <Monitor size={15} />, onRun: () => setTheme('system') },
      { id: 'reload', label: t('shell.commands.reload'), group: t('shell.commands.groupApplication'), icon: <RefreshCw size={15} />, onRun: () => window.location.reload() },
    );
    if (desktop) {
      items.push(
        { id: 'win-min', label: t('shell.commands.minimizeWindow'), group: t('shell.commands.groupWindow'), icon: <Minus size={15} />, onRun: () => void desktopWindow.minimize() },
        { id: 'win-max', label: t('shell.commands.maximizeWindow'), group: t('shell.commands.groupWindow'), icon: <Maximize2 size={15} />, onRun: () => void desktopWindow.toggleMaximize() },
        { id: 'win-fullscreen', label: t('shell.commands.fullscreen'), group: t('shell.commands.groupWindow'), icon: <Maximize2 size={15} />, onRun: () => void desktopWindow.toggleFullscreen() },
        { id: 'win-close', label: t('shell.commands.closeWindow'), group: t('shell.commands.groupWindow'), icon: <X size={15} />, onRun: () => void desktopWindow.close() },
      );
    }
    return items;
  }, [desktop, onNavigate, onOverview, setTheme, shortcuts, t]);

  return (
    <header
      className="tb-root"
      data-desktop={desktop || undefined}
      style={{ '--tb-end-w': `${endWidth}px` } as CSSProperties}
      {...dragHandlers}
    >
      <div className="tb-start">
        <BrandMark />
        <span className="tb-divider" aria-hidden="true" />
        <NavTabs routes={ROUTES} activeId={activeRoute.id} onSelect={onNavigate} />
      </div>

      <div className="tb-center">
        <Tooltip content={t('shell.titlebar.searchCommands')} shortcut={shortcuts.palette} placement="bottom" className="tb-tip">
        <button
          type="button"
          className="tb-command"
          onClick={() => setPaletteOpen(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts={formatShortcut(shortcuts.palette ?? '')}
        >
          <Search size={13} strokeWidth={2} className="tb-command-icon" />
          <span className="tb-command-text">{t('shell.titlebar.searchPlaceholder')}</span>
          <kbd className="tb-kbd">{formatShortcut(shortcuts.palette ?? '')}</kbd>
        </button>
        </Tooltip>
      </div>

      <div className="tb-end" ref={endRef}>
        <Tooltip content={t(online ? 'shell.titlebar.connected' : 'shell.titlebar.offline')} placement="bottom" className="tb-tip">
          <span className="tb-status" data-online={online}>
            <span className="tb-status-dot" aria-hidden="true" />
            <span className="tb-status-text">{t(online ? 'shell.titlebar.online' : 'shell.titlebar.offline')}</span>
          </span>
        </Tooltip>
        <Tooltip content={t('shell.titlebar.language')} placement="bottom" className="tb-tip">
        <span className="tb-lang-wrap">
        <DropdownMenu
          placement="bottom-end"
          aria-label={t('shell.titlebar.language')}
          items={LANGUAGES.map((l) => ({ id: l.code, label: l.label, checked: l.code === locale, onSelect: () => setLocale(l.code) }))}
          trigger={
            <button type="button" className="tb-lang" aria-label={t('shell.titlebar.language')}>
              <Languages size={14} />
              <span className="tb-lang-code">{locale}</span>
              <ChevronDown size={12} className="tb-lang-caret" />
            </button>
          }
        />
        </span>
        </Tooltip>
        <Tooltip content={t(theme === 'dark' ? 'shell.titlebar.switchToLight' : 'shell.titlebar.switchToDark')} placement="bottom" className="tb-tip">
          <button type="button" className="tb-icon-btn tb-theme" data-theme-state={theme} aria-label={t('shell.titlebar.toggleTheme')} onClick={toggleTheme}>
            <Sun size={15} className="tb-theme-sun" />
            <Moon size={15} className="tb-theme-moon" />
          </button>
        </Tooltip>
        <Popover
          open={notificationsOpen}
          onOpenChange={toggleNotifications}
          placement="bottom-end"
          className="tb-notif-popover"
          aria-label={t('shell.notificationsPanel.title')}
          trigger={({ ref, props }) => (
            <Tooltip content={t('shell.titlebar.notifications')} placement="bottom" className="tb-tip">
              <button
                ref={ref as Ref<HTMLButtonElement>}
                type="button"
                className="tb-icon-btn tb-notif"
                aria-label={notificationCount > 0 ? `${t('shell.titlebar.notifications')} (${notificationCount})` : t('shell.titlebar.notifications')}
                {...props}
              >
                <Bell size={15} />
                {notificationCount > 0 && <span className="tb-notif-badge" aria-hidden="true">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </button>
            </Tooltip>
          )}
        >
          <NotificationList onNavigate={() => toggleNotifications(false)} />
        </Popover>
        {desktop && (
          <>
            <span className="tb-divider" aria-hidden="true" />
            <WindowControls />
          </>
        )}
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
    </header>
  );
}
