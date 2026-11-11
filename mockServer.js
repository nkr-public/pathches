import { rowsToIpc } from '@dec/grid'
const FIRST = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Edsger', 'Donald']
const LAST = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Dijkstra', 'Knuth']
const CITIES = ['Paris', 'Lyon', 'Berlin', 'Madrid', 'Rome', 'Oslo', 'Lisbon', 'Vienna']
const STATUS = ['new', 'active', 'paused', 'closed']
const ICONS = { new: 'NEW', active: 'ACT', paused: 'PAU', closed: 'CLO' }

export const STATUS_OPTIONS = STATUS.map((s) => ({ value: s, label: s.toUpperCase() }))
export { ICONS }

const EXTRA = 20

/** @type {import('@dec/grid').DatasetSchema} */
export const SCHEMA = {
  version: 1,
  rowIdColumn: 'id',
  columns: [
    { id: 'id', type: 'int', nullable: false },
    { id: 'firstName', type: 'string', nullable: false },
    { id: 'lastName', type: 'string', nullable: false },
    { id: 'email', type: 'string', nullable: true },
    { id: 'city', type: 'string', nullable: true },
    { id: 'status', type: 'string', nullable: false },
    { id: 'age', type: 'int', nullable: true },
    { id: 'salary', type: 'float', nullable: true },
    { id: 'active', type: 'bool', nullable: false },
    { id: 'hired', type: 'date', nullable: true },
    ...Array.from({ length: EXTRA }, (_, i) => ({ id: `metric${i + 1}`, type: i % 3 === 0 ? 'int' : 'float', nullable: true })),
  ],
}

export function generateRows(n) {
  const rows = new Array(n)
  let seed = 42
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < n; i++) {
    const f = FIRST[(rnd() * FIRST.length) | 0]
    const l = LAST[(rnd() * LAST.length) | 0]
    const row = {
      id: i + 1,
      firstName: f,
      lastName: l,
      email: `${f}.${l}${i}@example.com`.toLowerCase(),
      city: CITIES[(rnd() * CITIES.length) | 0],
      status: STATUS[(rnd() * STATUS.length) | 0],
      age: 18 + ((rnd() * 47) | 0),
      salary: Math.round(rnd() * 120000) / 1,
      active: rnd() > 0.3,
      hired: new Date(Date.UTC(2005 + ((rnd() * 20) | 0), (rnd() * 12) | 0, 1 + ((rnd() * 27) | 0))),
    }
    for (let m = 0; m < EXTRA; m++) row[`metric${m + 1}`] = m % 3 === 0 ? (rnd() * 1000) | 0 : Math.round(rnd() * 100000) / 100
    rows[i] = row
  }
  return rows
}

const server = { patches: new Map(), deleted: new Set(), inserted: new Map(), nextId: 1000001 }

export function nextServerId() {
  return server.nextId++
}

export function applyToServer(events) {
  for (const e of events) {
    if (e.type === 'delete') {
      server.deleted.add(e.key)
      server.inserted.delete(e.key)
    } else if (e.type === 'create') {
      server.deleted.delete(e.key)
      server.inserted.set(e.key, { ...e.row, id: e.key })
    } else {
      server.patches.set(e.key, { ...server.patches.get(e.key), ...e.row })
      const ins = server.inserted.get(e.key)
      if (ins) server.inserted.set(e.key, { ...ins, ...e.row })
    }
  }
}

function snapshot(count) {
  const rows = generateRows(count)
  const out = []
  for (const row of rows) {
    if (server.deleted.has(row.id)) continue
    const p = server.patches.get(row.id)
    out.push(p ? { ...row, ...p } : row)
  }
  for (const row of server.inserted.values()) if (!server.deleted.has(row.id)) out.push(row)
  return out
}

export function createLoadProvider(count) {
  const load = async () => {
    const rows = snapshot(count)
    return { schema: SCHEMA, rowCount: rows.length, rows }
  }
  return {
    load,
    reload: load,
    getRowCount: () => count,
    getRowId: (row) => row.id,
    getSchema: () => SCHEMA,
    dispose() {},
  }
}

export function createMutationProvider(failRate = 0.1) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms))
  const apply = (c) => {
    let id = (c.current ?? c.original)?.id
    if (id === undefined || id === null) {
      if (c.kind !== 'INSERT') return
      id = server.nextId++
    }
    if (c.kind === 'DELETE') {
      server.deleted.add(id)
      server.inserted.delete(id)
    } else if (c.kind === 'INSERT') {
      server.deleted.delete(id)
      server.inserted.set(id, { ...c.current, id })
    } else {
      const patch = server.patches.get(id) ?? {}
      for (const f of c.changedFields) patch[f] = c.current[f]
      server.patches.set(id, patch)
      const ins = server.inserted.get(id)
      if (ins) server.inserted.set(id, { ...ins, ...patch })
    }
  }
  return {
    async commit(set) {
      await delay(400)
      return set.changes.map((c) => {
        if (Math.random() < failRate) return { rowId: c.rowId, ok: false, error: 'Server rejected the change' }
        apply(c)
        return { rowId: c.rowId, ok: true, newVersion: (c.originalVersion ?? 0) + 1 }
      })
    },
    async update() {
      return []
    },
  }
}

export function createArrowLoadProvider(count, chunkSize = 65536) {
  const load = async () => {
    const rows = snapshot(count)
    return { schema: SCHEMA, rowCount: rows.length, ipcChunks: rowsToIpc(SCHEMA, rows, chunkSize) }
  }
  return {
    load,
    reload: load,
    getRowCount: () => count,
    getRowId: (row) => row.id,
    getSchema: () => SCHEMA,
    dispose() {},
  }
}
