export function findDebugDalfEntry(archive) {
  return archive.packageEntries.find(
    (entry) =>
      (
        entry.path.startsWith('debug/') ||
        entry.path.endsWith('/data/debug-locations.dalf')
      ) &&
      entry.path.endsWith('.dalf'),
  )
}
