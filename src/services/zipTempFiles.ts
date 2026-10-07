// Only the exact UUID file names emitted by Core Safe are eligible. Never
// recurse into directories or remove arbitrary core-safe-* / other app files.
const TEMP_ZIP = /^core-safe-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip$/i;
const STALE_AFTER = 24 * 60 * 60 * 1000;
const lockName = (name: string) => `core-safe:temporary-zip:${name}`;

export async function acquireZipLease(name: string): Promise<() => Promise<void>> {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let ready!: () => void, failed!: (error: unknown) => void;
  const acquired = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject; });
  const request = navigator.locks.request(lockName(name), async () => { ready(); await held; });
  void request.catch(failed);
  await acquired;
  return async () => { release(); await request; };
}

export async function cleanupStaleZipFiles(root: FileSystemDirectoryHandle, now = Date.now()): Promise<void> {
  const locks = navigator.locks;
  const directory = root as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  if (!locks || !directory.entries) return;
  // A failed sweep must not broaden its scope or delete a currently used ZIP.
  // Individual inaccessible/deleted files are skipped; a future run can retry.
  try {
    for await (const [name, handle] of directory.entries()) {
      if (!TEMP_ZIP.test(name) || handle.kind !== 'file') continue;
      try {
        await locks.request(lockName(name), { ifAvailable: true }, async lock => {
          if (!lock) return; // Another tab still generates/displays/downloads it.
          const file = await (handle as FileSystemFileHandle).getFile();
          if (file.lastModified <= now - STALE_AFTER) await root.removeEntry(name);
        });
      } catch { /* Preserve files whose state cannot be established safely. */ }
    }
  } catch { /* OPFS enumeration may be unavailable or access may have changed. */ }
}
