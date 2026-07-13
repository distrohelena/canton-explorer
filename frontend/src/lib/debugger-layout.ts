export function resolveDefaultControlPanelX(
  workspaceWidth: number,
  panelWidth: number,
  inset: number,
) {
  return Math.max(inset, workspaceWidth - panelWidth - inset);
}
