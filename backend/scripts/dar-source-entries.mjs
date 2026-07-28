export function findDamlSourceEntries(archive) {
  if (Array.isArray(archive.sourceFiles)) {
    return archive.sourceFiles
  }

  return archive.packageEntries.filter((entry) => entry.path.endsWith('.daml'))
}
