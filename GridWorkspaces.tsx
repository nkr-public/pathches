import { useMemo, useRef, type ComponentType } from 'react';
import { CacheFormat, CacheMode, DataGrid, GridWorkspaceProvider, StorageKind, createRowEditProvider, type CacheOptions, type DataGridProps, type DataLoadProvider, type DataMutationProvider } from '@dec/grid';
import { useTheme } from '@dec/ui';
import { useWorkspace, useWorkspaceHandle, type WorkspaceComponentProps } from '@dec/layout';
import { ContractWorkspace, CustomerWorkspace, MonitoringWorkspace } from './DemoWorkspaces.tsx';
import { createArrowLoadProvider, createMutationProvider } from '../../data/mockServer.js';

export const GRID_SLEEP_AFTER_MS = 60_000;

const COLUMNS = [
  { id: 'id', headerName: 'ID', width: 80, editable: false },
  { id: 'firstName', headerName: 'First name', width: 130 },
  { id: 'lastName', headerName: 'Last name', width: 130 },
  { id: 'city', headerName: 'City', width: 110 },
  { id: 'status', headerName: 'Status', width: 110 },
  { id: 'salary', headerName: 'Salary', width: 110 },
];

const ROW_EDITOR = createRowEditProvider({ renderAs: 'FULL_ROW' });
const EDITING = { mode: 'rowEditing', allowMultiple: true } as const;
const CHANGE_TRACKING = { enabled: true, preserveOriginal: true, persistPendingChanges: true, keepCommittedHistory: true };
const CACHE: CacheOptions = { mode: CacheMode.Persistent, storage: StorageKind.Fs, format: CacheFormat.Columns, chunkSize: 65536 };
const PROCESSOR = { enabled: true, maxProcessors: 1 };

export interface GenericWorkspaceConfig {
  columns: DataGridProps<any>['columns'];
  rows: number;
  keyColumn?: string;
  height?: number;
  loader?: (rows: number) => DataLoadProvider;
  mutation?: () => DataMutationProvider;
  header?: ComponentType<WorkspaceComponentProps>;
}

export const GENERIC_WORKSPACE_DEFAULTS: GenericWorkspaceConfig = {
  columns: COLUMNS,
  rows: 100_000,
  height: 320,
  loader: createArrowLoadProvider,
  mutation: () => createMutationProvider(0),
};

function GenericWorkspaceGrid({ workspaceId, config }: { workspaceId: string; config: GenericWorkspaceConfig }) {
  const { rows, columns, height } = config;
  const makeLoader = config.loader ?? createArrowLoadProvider;
  const makeMutation = config.mutation ?? GENERIC_WORKSPACE_DEFAULTS.mutation!;
  const loader = useMemo(() => makeLoader(rows), [makeLoader, rows]);
  const mutation = useMemo(() => makeMutation(), [makeMutation]);
  const workspace = useWorkspace();
  const { theme } = useTheme();
  const gridRef = useRef<{ commitChanges(): Promise<void> } | null>(null);
  const pending = useRef(0);
  useWorkspaceHandle('grid', {
    serialize: () => ({}),
    isDirty: () => pending.current > 0,
    save: async () => {
      await gridRef.current?.commitChanges();
    },
  });
  return (
    <GridWorkspaceProvider config={{ maxProcessors: 1, idleDelayMs: GRID_SLEEP_AFTER_MS }}>
      <div style={{ height, margin: '0 12px 12px' }}>
        <DataGrid
          ref={gridRef as never}
          onChangesDetected={(c) => {
            const had = pending.current > 0;
            pending.current = c.total;
            if (c.total > 0) workspace.markDirty();
            else if (had) workspace.markClean();
          }}
          gridId={`layout-${workspaceId}`}
          profile="workspace"
          keyColumn={config.keyColumn ?? 'id'}
          columns={columns}
          dataLoadProvider={loader}
          dataMutationProvider={mutation}
          rowEditProvider={ROW_EDITOR}
          editing={EDITING}
          changeTracking={CHANGE_TRACKING}
          cache={CACHE}
          processor={PROCESSOR}
          refreshOnOpen="always"
          theme={theme === 'light' ? 'light' : 'dark'}
        />
      </div>
    </GridWorkspaceProvider>
  );
}

export function GenericWorkspace({ config, ...props }: WorkspaceComponentProps & { config?: Partial<GenericWorkspaceConfig> }) {
  const merged = { ...GENERIC_WORKSPACE_DEFAULTS, ...config };
  const Header = merged.header;
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {Header && <Header {...props} />}
      <GenericWorkspaceGrid workspaceId={props.workspaceId} config={merged} />
    </div>
  );
}

export function extendGenericWorkspace(config: Partial<GenericWorkspaceConfig>) {
  return function ExtendedGenericWorkspace(props: WorkspaceComponentProps) {
    return <GenericWorkspace {...props} config={config} />;
  };
}

export const CustomerGridWorkspace = extendGenericWorkspace({ header: CustomerWorkspace });
export const ContractGridWorkspace = extendGenericWorkspace({ header: ContractWorkspace });
export const MonitoringGridWorkspace = extendGenericWorkspace({ header: MonitoringWorkspace });
