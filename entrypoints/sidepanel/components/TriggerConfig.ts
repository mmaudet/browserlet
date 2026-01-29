/**
 * TriggerConfig component for editing trigger conditions
 * Allows users to set URL patterns, element hints, and mode
 */

import van from 'vanjs-core';
import type { TriggerConfig as TriggerConfigType, TriggerCondition, TriggerMode } from '../../../utils/triggers/types';
import { getTriggers } from '../../../utils/storage/triggers';

const { div, h3, label, input, select, option, button, span, textarea } = van.tags;

// Helper to get i18n messages
const msg = (key: string, substitutions?: string[]): string =>
  chrome.i18n.getMessage(key, substitutions) || key;

interface TriggerConfigProps {
  scriptId: string;
  onClose: () => void;
}

/**
 * TriggerConfig component
 */
export function TriggerConfig({ scriptId, onClose }: TriggerConfigProps) {
  // State
  const triggers = van.state<TriggerConfigType[]>([]);
  const isLoading = van.state(true);
  const isSaving = van.state(false);

  // Current editing state
  const urlPattern = van.state('');
  const mode = van.state<TriggerMode>('suggest');
  const enabled = van.state(true);
  const cooldownMin = van.state(5);
  const editingId = van.state<string | null>(null);

  // Load existing triggers
  async function loadTriggers(): Promise<void> {
    isLoading.val = true;
    try {
      triggers.val = await getTriggers(scriptId);
    } finally {
      isLoading.val = false;
    }
  }

  // Save trigger
  async function saveTrigger(): Promise<void> {
    if (!urlPattern.val.trim()) return;

    isSaving.val = true;
    try {
      const condition: TriggerCondition = {
        url_pattern: urlPattern.val.trim()
      };

      const trigger: TriggerConfigType = {
        id: editingId.val || crypto.randomUUID(),
        scriptId,
        name: `URL: ${urlPattern.val}`,
        conditions: [condition],
        mode: mode.val,
        enabled: enabled.val,
        cooldownMs: cooldownMin.val * 60 * 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await chrome.runtime.sendMessage({
        type: 'SAVE_TRIGGER',
        payload: trigger
      });

      // Reset form and reload
      resetForm();
      await loadTriggers();
    } finally {
      isSaving.val = false;
    }
  }

  // Delete trigger
  async function deleteTrigger(triggerId: string): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'DELETE_TRIGGER',
      payload: triggerId
    });
    await loadTriggers();
  }

  // Edit existing trigger
  function editTrigger(trigger: TriggerConfigType): void {
    editingId.val = trigger.id;
    urlPattern.val = trigger.conditions[0]?.url_pattern || '';
    mode.val = trigger.mode;
    enabled.val = trigger.enabled;
    cooldownMin.val = Math.round((trigger.cooldownMs || 300000) / 60000);
  }

  // Reset form
  function resetForm(): void {
    editingId.val = null;
    urlPattern.val = '';
    mode.val = 'suggest';
    enabled.val = true;
    cooldownMin.val = 5;
  }

  // Initial load
  loadTriggers();

  return div({ class: 'trigger-config p-4' },
    // Header
    div({ class: 'flex justify-between items-center mb-4' },
      h3({ class: 'text-lg font-semibold' }, msg('triggerConfigTitle')),
      button({
        class: 'text-gray-500 hover:text-gray-700',
        onclick: onClose
      }, '\u00D7')
    ),

    // Form
    div({ class: 'space-y-4 mb-6' },
      // URL Pattern
      div(
        label({ class: 'block text-sm font-medium mb-1' }, msg('triggerUrlPattern')),
        input({
          type: 'text',
          class: 'w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500',
          placeholder: msg('triggerUrlPatternPlaceholder'),
          value: urlPattern,
          oninput: (e: Event) => { urlPattern.val = (e.target as HTMLInputElement).value; }
        })
      ),

      // Mode
      div(
        label({ class: 'block text-sm font-medium mb-1' }, msg('triggerModeLabel')),
        select({
          class: 'w-full px-3 py-2 border rounded',
          value: mode,
          onchange: (e: Event) => { mode.val = (e.target as HTMLSelectElement).value as TriggerMode; }
        },
          option({ value: 'suggest' }, msg('triggerModeSuggest')),
          option({ value: 'auto_execute' }, msg('triggerModeAutoExecute'))
        )
      ),

      // Cooldown (only for auto-execute)
      () => mode.val === 'auto_execute' ? div(
        label({ class: 'block text-sm font-medium mb-1' }, msg('triggerCooldown')),
        input({
          type: 'number',
          class: 'w-full px-3 py-2 border rounded',
          min: 1,
          max: 60,
          value: cooldownMin,
          oninput: (e: Event) => { cooldownMin.val = parseInt((e.target as HTMLInputElement).value) || 5; }
        })
      ) : null,

      // Enabled
      div({ class: 'flex items-center gap-2' },
        input({
          type: 'checkbox',
          id: 'trigger-enabled',
          checked: enabled,
          onchange: (e: Event) => { enabled.val = (e.target as HTMLInputElement).checked; }
        }),
        label({ for: 'trigger-enabled', class: 'text-sm' }, msg('triggerEnabled'))
      ),

      // Buttons
      div({ class: 'flex gap-2' },
        button({
          class: 'flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50',
          disabled: () => isSaving.val || !urlPattern.val.trim(),
          onclick: saveTrigger
        }, () => editingId.val ? msg('triggerSave') : msg('triggerSave')),

        () => editingId.val ? button({
          class: 'px-4 py-2 border rounded hover:bg-gray-100',
          onclick: resetForm
        }, 'Cancel') : null
      )
    ),

    // Existing triggers list
    div({ class: 'border-t pt-4' },
      h3({ class: 'text-sm font-medium mb-2' }, 'Existing Triggers'),

      () => isLoading.val
        ? div({ class: 'text-gray-500 text-sm' }, 'Loading...')
        : triggers.val.length === 0
          ? div({ class: 'text-gray-500 text-sm' }, 'No triggers configured')
          : div({ class: 'space-y-2' },
              ...triggers.val.map(trigger =>
                div({ class: 'flex items-center justify-between p-2 bg-gray-50 rounded' },
                  div({ class: 'flex-1' },
                    span({ class: 'text-sm font-medium' }, trigger.name),
                    span({
                      class: `ml-2 text-xs px-2 py-0.5 rounded ${trigger.mode === 'suggest' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`
                    }, trigger.mode),
                    !trigger.enabled ? span({ class: 'ml-2 text-xs text-gray-400' }, '(disabled)') : null
                  ),
                  div({ class: 'flex gap-1' },
                    button({
                      class: 'text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded',
                      onclick: () => editTrigger(trigger)
                    }, 'Edit'),
                    button({
                      class: 'text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded',
                      onclick: () => deleteTrigger(trigger.id)
                    }, msg('triggerDelete'))
                  )
                )
              )
            )
    )
  );
}
