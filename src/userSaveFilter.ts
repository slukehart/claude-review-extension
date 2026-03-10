// Schedules removal of fsPath from the set after 500ms.
// Called by SessionManager when a user-initiated save is detected.
export function scheduleSkipClear(fsPath: string, userSavedFiles: Set<string>): void {
  setTimeout(() => userSavedFiles.delete(fsPath), 500);
}

// Returns true if fsPath is in the skip set (i.e. was saved by the user).
// Does NOT remove the entry — scheduleSkipClear handles that.
export function shouldSkipChange(fsPath: string, userSavedFiles: Set<string>): boolean {
  return userSavedFiles.has(fsPath);
}
