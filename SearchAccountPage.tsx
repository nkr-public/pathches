import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelTopClose, PanelTopOpen, UserSearch } from 'lucide-react';
import { CacheFormat, CacheMode, DataGrid, GridWorkspaceProvider, StorageKind, type CacheOptions, type DataLoadProvider } from '@dec/grid';
import { GenericSearch, type SearchStatus } from '@dec/ui/search';
import { useTheme } from '@dec/ui';
import { AccountDef } from '@dec/cr-factory';
import { toSearchMetadata } from '../../search/tables.ts';
import { PageHeader } from '../../shell/PageHeader.tsx';
import { createArrowLoadProvider } from '../../data/mockServer.js';

const toHeader = (name: string) => name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const ACCOUNT_COLUMNS = AccountDef.fields.map((f) => ({
  id: f.field,
  headerName: toHeader(f.field),
  width: Math.min(Math.max((f.size ?? f.max ?? 12) * 8, 100), 280),
  editable: !f.isPrimaryKey && !f.isGenerated,
}));
const ACCOUNT_KEY = AccountDef.fields.find((f) => f.isPrimaryKey)?.field ?? AccountDef.fields[0].field;

const metadata = toSearchMetadata(AccountDef);
const TOTAL = metadata.numRows || 51;
const GRID_ROWS = 50_000;
const CACHE: CacheOptions = { mode: CacheMode.Persistent, storage: StorageKind.Fs, format: CacheFormat.Columns, chunkSize: 65536 };

export default function SearchAccountPage() {
  const [status, setStatus] = useState<SearchStatus>({ state: 'idle' });
  const [searchVisible, setSearchVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme } = useTheme();
  const loader = useMemo(() => createArrowLoadProvider(GRID_ROWS) as DataLoadProvider, []);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const handleSearch = useCallback(() => {
    stop();
    let progress = 0;
    setStatus((s) => ({ state: 'running', progress: 0, found: 0, total: TOTAL, errors: s.errors }));
    timer.current = setInterval(() => {
      progress = Math.min(100, progress + 8 + Math.random() * 12);
      const found = Math.round((progress / 100) * TOTAL);
      setStatus((s) => {
        const errors = progress > 55 && Math.random() < 0.15
          ? [...(s.errors ?? []), { id: crypto.randomUUID(), message: `Partition ${Math.ceil(Math.random() * 8)} timed out, partial results`, source: 'ACCOUNT', time: Date.now() }]
          : s.errors;
        return progress >= 100 ? { state: 'success', progress: 100, found: TOTAL, total: TOTAL, errors } : { ...s, progress, found, errors };
      });
      if (progress >= 100) stop();
    }, 250);
  }, [stop]);

  const handleCancel = useCallback(() => {
    stop();
    setStatus((s) => ({ ...s, state: 'cancelled' }));
  }, [stop]);

  const ToggleIcon = searchVisible ? PanelTopClose : PanelTopOpen;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        icon={UserSearch}
        title="Accounts"
        description="Search Accounts"
        actions={
          <button type="button" className="page-toggle" aria-pressed={searchVisible} onClick={() => setSearchVisible((v) => !v)}>
            <ToggleIcon size={14} />
            {searchVisible ? 'Hide search' : 'Show search'}
          </button>
        }
      />
      <div className="search-page">
        {searchVisible && (
          <div className="search-page-panel ui-scroll">
            <GenericSearch metadata={metadata} title="Account search" status={status} onSearch={handleSearch} onCancel={handleCancel} onReset={() => setStatus({ state: 'idle' })} />
          </div>
        )}
        <div className="search-page-grid">
          <GridWorkspaceProvider config={{ maxProcessors: 1 }}>
            <DataGrid
              gridId="account-search-grid"
              profile="workspace"
              keyColumn={ACCOUNT_KEY}
              columns={ACCOUNT_COLUMNS}
              dataLoadProvider={loader}
              cache={CACHE}
              processor={{ enabled: true, maxProcessors: 1 }}
              refreshOnOpen="always"
              theme={theme === 'light' ? 'light' : 'dark'}
            />
          </GridWorkspaceProvider>
        </div>
      </div>
    </div>
  );
}
