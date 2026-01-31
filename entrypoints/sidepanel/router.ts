import { signal } from '@preact/signals';
import type { Script } from '../../utils/types';

export type ViewName = 'list' | 'editor' | 'recording' | 'execution' | 'settings' | 'credentials';

export const currentView = signal<ViewName>('list');
export const editorScript = signal<Script | null>(null);

export function navigateTo(view: ViewName, script?: Script): void {
  if (view === 'editor' && script) {
    editorScript.value = script;
  }
  currentView.value = view;
}

export function goBack(): void {
  currentView.value = 'list';
  editorScript.value = null;
}
