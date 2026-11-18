// Saving text as a file in the browser's downloads. Used by the export and project pages.

import type { Model } from '../../model';

/** "Clinic appointments" becomes "clinic-appointments.diagramble.json". */
export function fileName(projectName: string, ending = 'diagramble.json'): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'project'}.${ending}`;
}

export function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves the project as a project file and returns the file's name. */
export function downloadModel(model: Model): string {
  const name = fileName(model.name);
  downloadText(JSON.stringify(model, null, 2), name);
  return name;
}
