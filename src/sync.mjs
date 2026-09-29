export const emptySnapshot = () => ({ cases: [], tasks: [], cooperatives: [] });

export function makeOperations(before, after) {
  const operations = [];
  for (const collection of ['cases', 'tasks', 'cooperatives']) {
    const oldRows = new Map(before[collection].map(row => [row.id, row]));
    const newRows = new Map(after[collection].map(row => [row.id, row]));
    for (const [id, row] of newRows) {
      const previous = oldRows.get(id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(row)) {
        operations.push({ collection, id, action: 'put', version: row._version || null, record: row });
      }
    }
    for (const [id, row] of oldRows) {
      if (!newRows.has(id)) operations.push({ collection, id, action: 'delete', version: row._version });
    }
  }
  return operations;
}
