/**
 * TriggerConfig component for editing trigger conditions
 * Allows users to set URL patterns, element hints, and mode
 */

import van from 'vanjs-core';
import type { TriggerConfig as TriggerConfigType, TriggerCondition, TriggerMode } from '../../../utils/triggers/types';
import { getTriggers } from '../../../utils/storage/triggers';

const { div, h3, label, input, select, option, button, span } = van.tags;

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

  return div({ style: 'padding: 16px;' },
    // Header
    div({ style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;' },
      h3({ style: 'font-size: 16px; font-weight: 600; margin: 0;' }, msg('triggerConfigTitle')),
      button({
        style: 'background: none; border: none; cursor: pointer; font-size: 20px; color: #666; padding: 4px 8px;',
        onclick: onClose
      }, '\u00D7')
    ),

    // Form
    div({ style: 'display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;' },
      // URL Pattern
      div(
        label({ style: 'display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;' }, msg('triggerUrlPattern')),
        input({
          type: 'text',
          style: 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;',
          placeholder: msg('triggerUrlPatternPlaceholder'),
          value: urlPattern,
          oninput: (e: Event) => { urlPattern.val = (e.target as HTMLInputElement).value; }
        })
      ),

      // Mode
      div(
        label({ style: 'display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;' }, msg('triggerModeLabel')),
        select({
          style: 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;',
          value: mode,
          onchange: (e: Event) => { mode.val = (e.target as HTMLSelectElement).value as TriggerMode; }
        },
          option({ value: 'suggest' }, msg('triggerModeSuggest')),
          option({ value: 'auto_execute' }, msg('triggerModeAutoExecute'))
        )
      ),

      // Cooldown (only for auto-execute)
      () => mode.val === 'auto_execute' ? div(
        label({ style: 'display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;' }, msg('triggerCooldown')),
        input({
          type: 'number',
          style: 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;',
          min: 1,
          max: 60,
          value: cooldownMin,
          oninput: (e: Event) => { cooldownMin.val = parseInt((e.target as HTMLInputElement).value) || 5; }
        })
      ) : null,

      // Enabled
      div({ style: 'display: flex; align-items: center; gap: 8px;' },
        input({
          type: 'checkbox',
          id: 'trigger-enabled',
          checked: enabled,
          onchange: (e: Event) => { enabled.val = (e.target as HTMLInputElement).checked; }
        }),
        label({ for: 'trigger-enabled', style: 'font-size: 14px;' }, msg('triggerEnabled'))
      ),

      // Buttons
      div({ style: 'display: flex; gap: 8px;' },
        button({
          style: () => `flex: 1; padding: 10px 16px; background: ${isSaving.val || !urlPattern.val.trim() ? '#ccc' : '#4285f4'}; color: white; border: none; border-radius: 6px; cursor: ${isSaving.val || !urlPattern.val.trim() ? 'not-allowed' : 'pointer'}; font-size: 14px;`,
          disabled: () => isSaving.val || !urlPattern.val.trim(),
          onclick: saveTrigger
        }, () => editingId.val ? msg('triggerSave') : msg('triggerSave')),

        () => editingId.val ? button({
          style: 'padding: 10px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: 14px;',
          onclick: resetForm
        }, 'Cancel') : null
      )
    ),

    // Existing triggers list
    div({ style: 'border-top: 1px solid #eee; padding-top: 16px;' },
      h3({ style: 'font-size: 14px; font-weight: 500; margin: 0 0 12px 0;' }, 'Existing Triggers'),

      () => isLoading.val
        ? div({ style: 'color: #999; font-size: 14px;' }, 'Loading...')
        : triggers.val.length === 0
          ? div({ style: 'color: #999; font-size: 14px;' }, 'No triggers configured')
          : div({ style: 'display: flex; flex-direction: column; gap: 8px;' },
              ...triggers.val.map(trigger =>
                div({ style: 'display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #f5f5f5; border-radius: 6px;' },
                  div({ style: 'flex: 1; min-width: 0;' },
                    span({ style: 'font-size: 14px; font-weight: 500;' }, trigger.name),
                    span({
                      style: `margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 4px; ${trigger.mode === 'suggest' ? 'background: #e3f2fd; color: #1976d2;' : 'background: #fff3e0; color: #e65100;'}`
                    }, trigger.mode),
                    !trigger.enabled ? span({ style: 'margin-left: 8px; font-size: 11px; color: #999;' }, '(disabled)') : null
                  ),
                  div({ style: 'display: flex; gap: 4px;' },
                    button({
                      style: 'font-size: 12px; padding: 4px 8px; color: #1976d2; background: none; border: none; cursor: pointer; border-radius: 4px;',
                      onclick: () => editTrigger(trigger)
                    }, 'Edit'),
                    button({
                      style: 'font-size: 12px; padding: 4px 8px; color: #d32f2f; background: none; border: none; cursor: pointer; border-radius: 4px;',
                      onclick: () => deleteTrigger(trigger.id)
                    }, msg('triggerDelete'))
                  )
                )
              )
            )
    )
  );
}
