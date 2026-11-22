import { useT } from '@dec/i18n/react';
import { messages } from '../../i18n/index.ts';
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, formatShortcut } from '@dec/ui';
import type { AppRoute } from '../../app/routes.ts';
import { useShortcuts } from '../shortcuts/store.ts';

interface NavTabsProps {
  routes: readonly AppRoute[];
  activeId: string;
  onSelect: (route: AppRoute) => void;
}

export function NavTabs({ routes, activeId, onSelect }: NavTabsProps) {
  const t = useT(messages);
  const shortcuts = useShortcuts();
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tab = list.querySelector<HTMLElement>(`[data-route="${activeId}"]`);
      if (tab) setBox({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeId, routes]);

  return (
    <nav className="tb-nav" aria-label={t('shell.titlebar.mainNav')}>
      <div ref={listRef} className="tb-nav-list" role="tablist">
        {box && <span className="tb-nav-indicator" style={{ transform: `translateX(${box.left}px)`, width: box.width }} aria-hidden="true" />}
        {routes.map((route) => {
          const Icon = route.icon;
          const active = route.id === activeId;
          return (
            <Tooltip key={route.id} content={t(route.descriptionKey)} shortcut={shortcuts[route.id]} placement="bottom" delay={500} className="tb-tip">
              <button
                type="button"
                role="tab"
                data-route={route.id}
                aria-selected={active}
                aria-keyshortcuts={formatShortcut(shortcuts[route.id] ?? '')}
                className="tb-nav-tab"
                onClick={() => onSelect(route)}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} className="tb-nav-icon" />
                <span className="tb-nav-label">{t(route.labelKey)}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
