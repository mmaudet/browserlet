/**
 * TriggerConfig component for editing trigger conditions
 * Allows users to set URL patterns, element hints, and mode
 */

import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { TriggerConfig as TriggerConfigType, TriggerCondition, TriggerMode } from '../../../utils/triggers/types';
import { getTriggers } from '../../../utils/storage/triggers';

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
  // State - use useSignal for component-local state that persists across renders
  const triggers = useSignal<TriggerConfigType[]>([]);
  const isLoading = useSignal(true);
  const isSaving = useSignal(false);

  // Current editing state
  const urlPattern = useSignal('');
  const mode = useSignal<TriggerMode>('suggest');
  const enabled = useSignal(true);
  const cooldownMin = useSignal(5);
  const editingId = useSignal<string | null>(null);

  // Load existing triggers
  async function loadTriggers(): Promise<void> {
    isLoading.value = true;
    try {
      triggers.value = await getTriggers(scriptId);
    } finally {
      isLoading.value = false;
    }
  }

  // Save trigger
  async function saveTrigger(): Promise<void> {
    if (!urlPattern.value.trim()) return;

    isSaving.value = true;
    try {
      const condition: TriggerCondition = {
        url_pattern: urlPattern.value.trim()
      };

      const trigger: TriggerConfigType = {
        id: editingId.value || crypto.randomUUID(),
        scriptId,
        name: `URL: ${urlPattern.value}`,
        conditions: [condition],
        mode: mode.value,
        enabled: enabled.value,
        cooldownMs: cooldownMin.value * 60 * 1000,
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
      isSaving.value = false;
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
    editingId.value = trigger.id;
    urlPattern.value = trigger.conditions[0]?.url_pattern || '';
    mode.value = trigger.mode;
    enabled.value = trigger.enabled;
    cooldownMin.value = Math.round((trigger.cooldownMs || 300000) / 60000);
  }

  // Reset form
  function resetForm(): void {
    editingId.value = null;
    urlPattern.value = '';
    mode.value = 'suggest';
    enabled.value = true;
    cooldownMin.value = 5;
  }

  // Initial load on mount
  useEffect(() => {
    loadTriggers();
  }, [scriptId]);

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{msg('triggerConfigTitle')}</h3>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', padding: '4px 8px' }}
          onClick={onClose}
        >
          {'\u00D7'}
        </button>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {/* URL Pattern */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{msg('triggerUrlPattern')}</label>
          <input
            type="text"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            placeholder={msg('triggerUrlPatternPlaceholder')}
            value={urlPattern.value}
            onInput={(e: Event) => { urlPattern.value = (e.target as HTMLInputElement).value; }}
          />
        </div>

        {/* Mode */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{msg('triggerModeLabel')}</label>
          <select
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            value={mode.value}
            onChange={(e: Event) => { mode.value = (e.target as HTMLSelectElement).value as TriggerMode; }}
          >
            <option value="suggest">{msg('triggerModeSuggest')}</option>
            <option value="auto_execute">{msg('triggerModeAutoExecute')}</option>
          </select>
        </div>

        {/* Cooldown (only for auto-execute) */}
        <div style={{ display: mode.value === 'auto_execute' ? 'block' : 'none' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{msg('triggerCooldown')}</label>
          <input
            type="number"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            min={1}
            max={60}
            value={cooldownMin.value}
            onInput={(e: Event) => { cooldownMin.value = parseInt((e.target as HTMLInputElement).value) || 5; }}
          />
        </div>

        {/* Enabled */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="trigger-enabled"
            checked={enabled.value}
            onChange={(e: Event) => { enabled.value = (e.target as HTMLInputElement).checked; }}
          />
          <label htmlFor="trigger-enabled" style={{ fontSize: '14px' }}>{msg('triggerEnabled')}</label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{
              flex: 1,
              padding: '10px 16px',
              background: isSaving.value || !urlPattern.value.trim() ? '#ccc' : '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSaving.value || !urlPattern.value.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
            disabled={isSaving.value || !urlPattern.value.trim()}
            onClick={saveTrigger}
          >
            {editingId.value ? msg('triggerSave') : msg('triggerSave')}
          </button>

          <button
            style={{
              padding: '10px 16px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              display: editingId.value ? 'block' : 'none'
            }}
            onClick={resetForm}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Existing triggers list */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 12px 0' }}>Existing Triggers</h3>

        {isLoading.value ? (
          <div style={{ color: '#999', fontSize: '14px' }}>Loading...</div>
        ) : triggers.value.length === 0 ? (
          <div style={{ color: '#999', fontSize: '14px' }}>No triggers configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {triggers.value.map(trigger => (
              <div
                key={trigger.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#f5f5f5', borderRadius: '6px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{trigger.name}</span>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: trigger.mode === 'suggest' ? '#e3f2fd' : '#fff3e0',
                    color: trigger.mode === 'suggest' ? '#1976d2' : '#e65100'
                  }}>
                    {trigger.mode}
                  </span>
                  {!trigger.enabled && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(disabled)</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    style={{ fontSize: '12px', padding: '4px 8px', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    onClick={() => editTrigger(trigger)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ fontSize: '12px', padding: '4px 8px', color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    onClick={() => deleteTrigger(trigger.id)}
                  >
                    {msg('triggerDelete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
