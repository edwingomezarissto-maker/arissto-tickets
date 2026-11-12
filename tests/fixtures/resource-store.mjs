import { randomUUID } from 'node:crypto';

export function memoryResourceStore() {
  const records = new Map();
  return {
    get: async key => structuredClone(records.get(key)?.data ?? null),
    getWithMetadata: async key => structuredClone(records.get(key) ?? null),
    list: async ({ prefix }) => ({ blobs: [...records.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
    delete: async key => { records.delete(key); },
    setJSON: async (key, data, options) => {
      if (options.onlyIfNew ? records.has(key) : !records.has(key) || records.get(key).etag !== options.onlyIfMatch) return { modified: false };
      const etag = randomUUID();
      records.set(key, { etag, data: structuredClone(data) }); return { modified: true, etag };
    },
  };
}
