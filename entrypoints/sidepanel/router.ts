import van from 'vanjs-core';
import type { Script } from '../../utils/types';

export type ViewName = 'list' | 'editor' | 'recording' | 'execution' | 'settings';

export const currentView = van.state<ViewName>('list');
export const editorScript = van.state<Script | null>(null);

export function navigateTo(view: ViewName, script?: Script): void {
  if (view === 'editor' && script) {
    editorScript.val = script;
  }
  currentView.val = view;
}

export function goBack(): void {
  currentView.val = 'list';
  editorScript.val = null;
}
