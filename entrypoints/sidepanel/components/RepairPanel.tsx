/**
 * RepairPanel component for reviewing and approving self-healing suggestions
 * Covers requirements: HEAL-03, HEAL-04, HEAL-08, HEAL-11
 */

import { useSignal } from '@preact/signals';
import { Wrench, Check, X, Play, Edit2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-preact';
import {
  repairQueue,
  activeRepair,
  hasPendingRepairs,
  pendingCount,
  setActiveRepair,
  updateRepairStatus,
  updateProposedHints,
  removeRepair,
  healingError,
  isHealingInProgress,
  type RepairSuggestion
} from '../stores/healing';
import { resetExecution } from '../stores/execution';
import type { SemanticHint, HintType } from '../../../entrypoints/content/playback/types';

// All 10 hint types from the semantic resolver
const HINT_TYPES: HintType[] = [
  'role',
  'text_contains',
  'type',
  'name',
  'placeholder_contains',
  'aria_label',
  'near_label',
  'class_contains',
  'data_attribute',
  'id'
];

/**
 * Get confidence level color based on threshold
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return '#34c759'; // Green - high confidence
  if (confidence >= 0.7) return '#ff9500'; // Orange - medium confidence
  return '#ff3b30'; // Red - low confidence
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * HintEditor subcomponent for editing individual hints
 */
interface HintEditorProps {
  hint: SemanticHint;
  index: number;
  onUpdate: (index: number, hint: SemanticHint) => void;
  onDelete: (index: number) => void;
  canDelete: boolean;
}

function HintEditor({ hint, index, onUpdate, onDelete, canDelete }: HintEditorProps) {
  const isEditing = useSignal(false);
  const editType = useSignal<HintType>(hint.type);
  const editValue = useSignal(
    typeof hint.value === 'object' ? `${hint.value.name}=${hint.value.value}` : hint.value
  );

  const handleSave = () => {
    let newValue: string | { name: string; value: string } = editValue.value;

    // Handle data_attribute type which requires object value
    if (editType.value === 'data_attribute' && editValue.value.includes('=')) {
      const [name, value] = editValue.value.split('=');
      newValue = { name: name.trim(), value: value.trim() };
    }

    onUpdate(index, { type: editType.value, value: newValue });
    isEditing.value = false;
  };

  const handleCancel = () => {
    editType.value = hint.type;
    editValue.value = typeof hint.value === 'object' ? `${hint.value.name}=${hint.value.value}` : hint.value;
    isEditing.value = false;
  };

  const displayValue = typeof hint.value === 'object'
    ? `${hint.value.name}="${hint.value.value}"`
    : hint.value;

  if (isEditing.value) {
    return (
      <div style={hintEditorStyles}>
        <select
          value={editType.value}
          onChange={(e) => editType.value = (e.target as HTMLSelectElement).value as HintType}
          style={selectStyles}
        >
          {HINT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          value={editValue.value}
          onChange={(e) => editValue.value = (e.target as HTMLInputElement).value}
          style={inputStyles}
          placeholder={editType.value === 'data_attribute' ? 'name=value' : 'value'}
        />
        <button onClick={handleSave} style={smallButtonStyles} title="Save">
          <Check size={14} color="#34c759" />
        </button>
        <button onClick={handleCancel} style={smallButtonStyles} title="Cancel">
          <X size={14} color="#ff3b30" />
        </button>
      </div>
    );
  }

  return (
    <div style={hintDisplayStyles}>
      <span style={hintTypeStyles}>{hint.type}</span>
      <span style={hintValueStyles}>{displayValue}</span>
      <button onClick={() => isEditing.value = true} style={editButtonStyles} title="Edit">
        <Edit2 size={12} />
      </button>
      {canDelete && (
        <button onClick={() => onDelete(index)} style={deleteHintButtonStyles} title="Delete hint">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/**
 * Active repair detail view
 */
function ActiveRepairView({ repair }: { repair: RepairSuggestion }) {
  const showDomExcerpt = useSignal(false);
  const testStatus = useSignal<'idle' | 'testing' | 'success' | 'failed'>(
    repair.status === 'testing' ? 'testing' : repair.status === 'approved' ? 'success' : 'idle'
  );
  const showConfirmDialog = useSignal(false);

  // Update proposed hints when edited
  const handleHintUpdate = (index: number, newHint: SemanticHint) => {
    const updatedHints = [...repair.proposedHints];
    updatedHints[index] = newHint;
    updateProposedHints(repair.id, updatedHints);
  };

  // Delete a hint from proposed hints
  const handleHintDelete = (index: number) => {
    const updatedHints = repair.proposedHints.filter((_, i) => i !== index);
    updateProposedHints(repair.id, updatedHints);
  };

  // Send TEST_REPAIR message
  const handleTest = async () => {
    testStatus.value = 'testing';
    updateRepairStatus(repair.id, 'testing');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Show testing highlight
        await chrome.tabs.sendMessage(tab.id, {
          type: 'HIGHLIGHT_HEALING_ELEMENT',
          payload: {
            hints: repair.proposedHints,
            state: 'testing'
          }
        });

        // Send test repair message
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TEST_REPAIR',
          payload: {
            repairId: repair.id,
            hints: repair.proposedHints
          }
        });
      }
    } catch (error) {
      console.error('[RepairPanel] Test failed:', error);
      testStatus.value = 'failed';
      updateRepairStatus(repair.id, 'pending');
    }
  };

  // Apply the repair (save to script)
  const handleApply = async () => {
    showConfirmDialog.value = false;

    try {
      // Send APPLY_REPAIR message to background for script update and audit trail
      await chrome.runtime.sendMessage({
        type: 'APPLY_REPAIR',
        payload: {
          repairId: repair.id,
          scriptId: repair.scriptId,
          scriptName: repair.scriptName,
          stepIndex: repair.stepIndex,
          originalHints: repair.originalHints,
          newHints: repair.proposedHints,
          confidence: repair.confidence,
          reason: repair.reason,
          pageUrl: repair.pageUrl
        }
      });

      // Hide overlay
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'HEALING_APPROVED' }).catch(() => {});
      }

      // Remove from queue
      removeRepair(repair.id);

      // Reset execution state (script was healed, not completed)
      resetExecution();
    } catch (error) {
      console.error('[RepairPanel] Apply failed:', error);
    }
  };

  // Reject the repair
  const handleReject = async () => {
    try {
      // Hide overlay
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'HEALING_REJECTED' }).catch(() => {});
      }

      // Send rejection message (to fail the step)
      await chrome.runtime.sendMessage({
        type: 'HEALING_REJECTED',
        payload: { repairId: repair.id }
      });

      // Remove from queue
      removeRepair(repair.id);

      // Reset execution state
      resetExecution();
    } catch (error) {
      console.error('[RepairPanel] Reject failed:', error);
      removeRepair(repair.id);
      resetExecution();
    }
  };

  // Show highlight on hover
  const handleMouseEnter = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'HIGHLIGHT_HEALING_ELEMENT',
          payload: {
            hints: repair.proposedHints,
            state: 'proposed'
          }
        });
      }
    } catch (error) {
      // Ignore errors when highlighting
    }
  };

  // Hide highlight on mouse leave (only if not testing)
  const handleMouseLeave = async () => {
    if (testStatus.value === 'testing') return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send empty hints to hide overlay
        await chrome.tabs.sendMessage(tab.id, {
          type: 'HIGHLIGHT_HEALING_ELEMENT',
          payload: {
            hints: [],
            state: 'proposed'
          }
        }).catch(() => {});
      }
    } catch (error) {
      // Ignore errors
    }
  };

  // Update testStatus when repair status changes
  if (repair.status === 'approved' && testStatus.value !== 'success') {
    testStatus.value = 'success';
  } else if (repair.status === 'pending' && testStatus.value === 'testing') {
    // Test completed but failed - reset to idle or failed
    testStatus.value = healingError.value ? 'failed' : 'idle';
  }

  const isTestPassed = repair.status === 'approved' || testStatus.value === 'success';

  return (
    <div
      style={activeRepairStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Step info and confidence */}
      <div style={stepInfoStyles}>
        <span style={{ fontWeight: 500 }}>
          Step {repair.stepIndex + 1}
        </span>
        <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
          {repair.scriptName}
        </span>
        <span
          style={{
            ...confidenceBadgeStyles,
            background: getConfidenceColor(repair.confidence),
          }}
        >
          {formatConfidence(repair.confidence)}
        </span>
      </div>

      {/* Error display */}
      {healingError.value && (
        <div style={errorStyles}>
          <AlertTriangle size={14} />
          <span>{healingError.value}</span>
        </div>
      )}

      {/* Original hints (failed) */}
      <div style={sectionStyles}>
        <div style={sectionTitleStyles}>
          {chrome.i18n.getMessage('originalHints') || 'Original (failed)'}
        </div>
        <div style={hintsListStyles}>
          {repair.originalHints.map((hint, i) => (
            <div key={i} style={hintReadOnlyStyles}>
              <span style={hintTypeStyles}>{hint.type}</span>
              <span style={hintValueStyles}>
                {typeof hint.value === 'object'
                  ? `${hint.value.name}="${hint.value.value}"`
                  : hint.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Proposed hints (editable) */}
      <div style={sectionStyles}>
        <div style={sectionTitleStyles}>
          {chrome.i18n.getMessage('proposedHints') || 'Proposed'}
        </div>
        <div style={hintsListStyles}>
          {repair.proposedHints.map((hint, i) => (
            <HintEditor
              key={i}
              hint={hint}
              index={i}
              onUpdate={handleHintUpdate}
              onDelete={handleHintDelete}
              canDelete={repair.proposedHints.length > 1}
            />
          ))}
        </div>
      </div>

      {/* Reason from LLM */}
      <div style={sectionStyles}>
        <div style={sectionTitleStyles}>
          {chrome.i18n.getMessage('llmReason') || 'Reason'}
        </div>
        <div style={reasonStyles}>{repair.reason}</div>
      </div>

      {/* DOM excerpt (collapsible) */}
      <div style={sectionStyles}>
        <button
          onClick={() => showDomExcerpt.value = !showDomExcerpt.value}
          style={collapsibleButtonStyles}
        >
          {chrome.i18n.getMessage('domContext') || 'DOM Context'}
          {showDomExcerpt.value ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showDomExcerpt.value && (
          <div style={domExcerptStyles}>
            <pre style={domPreStyles}>{repair.domExcerpt}</pre>
            <div style={pageContextStyles}>
              <div><strong>URL:</strong> {repair.pageUrl}</div>
              <div><strong>Title:</strong> {repair.pageTitle}</div>
            </div>
          </div>
        )}
      </div>

      {/* Test result indicator */}
      {testStatus.value === 'success' && (
        <div style={testResultStyles}>
          <Check size={14} color="#34c759" />
          <span style={{ color: '#34c759' }}>
            {chrome.i18n.getMessage('testPassed') || 'Test passed'}
          </span>
        </div>
      )}
      {testStatus.value === 'failed' && (
        <div style={testResultStyles}>
          <X size={14} color="#ff3b30" />
          <span style={{ color: '#ff3b30' }}>
            {chrome.i18n.getMessage('testFailed') || 'Test failed'}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div style={actionsStyles}>
        <button
          onClick={handleTest}
          disabled={testStatus.value === 'testing'}
          style={{
            ...testButtonStyles,
            opacity: testStatus.value === 'testing' ? 0.6 : 1,
            cursor: testStatus.value === 'testing' ? 'not-allowed' : 'pointer'
          }}
        >
          <Play size={14} />
          {testStatus.value === 'testing'
            ? (chrome.i18n.getMessage('testing') || 'Testing...')
            : (chrome.i18n.getMessage('testRepair') || 'Test')}
        </button>
        <button
          onClick={() => showConfirmDialog.value = true}
          disabled={!isTestPassed}
          style={{
            ...applyButtonStyles,
            opacity: isTestPassed ? 1 : 0.5,
            cursor: isTestPassed ? 'pointer' : 'not-allowed'
          }}
        >
          <Check size={14} />
          {chrome.i18n.getMessage('applyFix') || 'Apply Fix'}
        </button>
        <button onClick={handleReject} style={rejectButtonStyles}>
          <X size={14} />
          {chrome.i18n.getMessage('rejectRepair') || 'Reject'}
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog.value && (
        <div style={dialogOverlayStyles}>
          <div style={dialogStyles}>
            <p style={{ margin: '0 0 16px 0' }}>
              {chrome.i18n.getMessage('saveFix') || 'Save this fix to the script?'}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => showConfirmDialog.value = false}
                style={cancelButtonStyles}
              >
                {chrome.i18n.getMessage('cancel') || 'Cancel'}
              </button>
              <button onClick={handleApply} style={confirmButtonStyles}>
                {chrome.i18n.getMessage('confirm') || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Queue list item
 */
function QueueItem({ repair, isActive }: { repair: RepairSuggestion; isActive: boolean }) {
  return (
    <div
      style={{
        ...queueItemStyles,
        background: isActive ? '#e3f2fd' : 'white'
      }}
      onClick={() => setActiveRepair(repair.id)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '13px' }}>
          Step {repair.stepIndex + 1}
        </div>
        <div style={{ fontSize: '11px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {repair.scriptName}
        </div>
      </div>
      <span
        style={{
          ...confidenceBadgeSmallStyles,
          background: getConfidenceColor(repair.confidence),
        }}
      >
        {formatConfidence(repair.confidence)}
      </span>
    </div>
  );
}

/**
 * Main RepairPanel component
 */
export function RepairPanel() {
  const hasRepairs = hasPendingRepairs.value || repairQueue.value.length > 0;
  const healingInProgress = isHealingInProgress.value;
  const active = activeRepair.value;
  const count = pendingCount.value;
  const queue = repairQueue.value;

  // Show panel if there are repairs OR if healing is in progress
  if (!hasRepairs && !healingInProgress) {
    return null;
  }

  return (
    <div style={panelStyles}>
      {/* CSS for blinking animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
        .healing-indicator {
          animation: blink 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div style={headerStyles}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={16} color="#ff9500" />
          <span style={{ fontWeight: 500 }}>
            {chrome.i18n.getMessage('repairs') || 'Repairs'}
          </span>
          {healingInProgress && !hasRepairs && (
            <span className="healing-indicator" style={healingBadgeStyles}>
              {chrome.i18n.getMessage('healingInProgress') || 'Healing...'}
            </span>
          )}
          {count > 0 && (
            <span style={countBadgeStyles}>
              {count} {chrome.i18n.getMessage('repairsPending') || 'pending'}
            </span>
          )}
        </div>
      </div>

      {/* Active repair detail */}
      {active && <ActiveRepairView repair={active} />}

      {/* Queue list (collapsed when viewing active) */}
      {queue.length > 1 && (
        <div style={queueStyles}>
          <div style={queueTitleStyles}>Queue ({queue.length})</div>
          {queue.map(repair => (
            <QueueItem
              key={repair.id}
              repair={repair}
              isActive={repair.id === active?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const panelStyles: Record<string, string | number> = {
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  overflow: 'hidden',
  marginTop: '12px'
};

const headerStyles: Record<string, string | number> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  background: '#fef3e0'
};

const countBadgeStyles: Record<string, string | number> = {
  fontSize: '11px',
  color: '#ff9500',
  background: 'rgba(255, 149, 0, 0.15)',
  padding: '2px 8px',
  borderRadius: '10px'
};

const healingBadgeStyles: Record<string, string | number> = {
  fontSize: '11px',
  color: '#007AFF',
  background: 'rgba(0, 122, 255, 0.15)',
  padding: '2px 8px',
  borderRadius: '10px',
  fontWeight: 500
};

const activeRepairStyles: Record<string, string | number> = {
  padding: '16px'
};

const stepInfoStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '12px'
};

const confidenceBadgeStyles: Record<string, string | number> = {
  marginLeft: 'auto',
  padding: '2px 8px',
  borderRadius: '10px',
  color: 'white',
  fontSize: '11px',
  fontWeight: 500
};

const confidenceBadgeSmallStyles: Record<string, string | number> = {
  padding: '1px 6px',
  borderRadius: '8px',
  color: 'white',
  fontSize: '10px',
  fontWeight: 500,
  flexShrink: 0
};

const sectionStyles: Record<string, string | number> = {
  marginBottom: '12px'
};

const sectionTitleStyles: Record<string, string | number> = {
  fontSize: '11px',
  color: '#888',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: 500
};

const hintsListStyles: Record<string, string | number> = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

const hintDisplayStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  background: '#f5f5f5',
  borderRadius: '4px',
  fontSize: '12px'
};

const hintReadOnlyStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  background: '#fee2e2',
  borderRadius: '4px',
  fontSize: '12px',
  opacity: 0.8
};

const hintEditorStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  background: '#e3f2fd',
  borderRadius: '4px',
  fontSize: '12px'
};

const hintTypeStyles: Record<string, string | number> = {
  fontWeight: 500,
  color: '#333',
  minWidth: '100px',
  flexShrink: 0
};

const hintValueStyles: Record<string, string | number> = {
  color: '#666',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const editButtonStyles: Record<string, string | number> = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#8e8e93',
  padding: '2px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const deleteHintButtonStyles: Record<string, string | number> = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#ff3b30',
  padding: '2px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginLeft: '4px'
};

const selectStyles: Record<string, string | number> = {
  fontSize: '11px',
  padding: '2px 4px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  background: 'white',
  minWidth: '100px'
};

const inputStyles: Record<string, string | number> = {
  flex: 1,
  fontSize: '12px',
  padding: '2px 6px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  minWidth: 0
};

const smallButtonStyles: Record<string, string | number> = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const reasonStyles: Record<string, string | number> = {
  fontSize: '13px',
  color: '#333',
  lineHeight: 1.4,
  padding: '8px',
  background: '#f8f8f8',
  borderRadius: '4px'
};

const collapsibleButtonStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'none',
  border: 'none',
  padding: '0',
  fontSize: '11px',
  color: '#666',
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontWeight: 500
};

const domExcerptStyles: Record<string, string | number> = {
  marginTop: '8px'
};

const domPreStyles: Record<string, string | number> = {
  fontSize: '10px',
  fontFamily: 'monospace',
  background: '#f0f0f0',
  padding: '8px',
  borderRadius: '4px',
  overflow: 'auto',
  maxHeight: '150px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0
};

const pageContextStyles: Record<string, string | number> = {
  fontSize: '11px',
  color: '#666',
  marginTop: '8px'
};

const errorStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  background: '#fee2e2',
  borderRadius: '4px',
  color: '#dc2626',
  fontSize: '12px',
  marginBottom: '12px'
};

const testResultStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  marginBottom: '12px',
  padding: '6px 10px',
  borderRadius: '4px',
  background: '#f0f0f0'
};

const actionsStyles: Record<string, string | number> = {
  display: 'flex',
  gap: '8px',
  marginTop: '16px'
};

const testButtonStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  border: '1px solid #007AFF',
  borderRadius: '6px',
  background: 'white',
  color: '#007AFF',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer'
};

const applyButtonStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  border: 'none',
  borderRadius: '6px',
  background: '#34c759',
  color: 'white',
  fontSize: '13px',
  fontWeight: 500
};

const rejectButtonStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  border: '1px solid #ff3b30',
  borderRadius: '6px',
  background: 'white',
  color: '#ff3b30',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer'
};

const dialogOverlayStyles: Record<string, string | number> = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
};

const dialogStyles: Record<string, string | number> = {
  background: 'white',
  borderRadius: '8px',
  padding: '20px',
  maxWidth: '320px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
};

const cancelButtonStyles: Record<string, string | number> = {
  padding: '8px 16px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  background: 'white',
  color: '#333',
  fontSize: '13px',
  cursor: 'pointer'
};

const confirmButtonStyles: Record<string, string | number> = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  background: '#34c759',
  color: 'white',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer'
};

const queueStyles: Record<string, string | number> = {
  borderTop: '1px solid #e0e0e0',
  maxHeight: '150px',
  overflowY: 'auto'
};

const queueTitleStyles: Record<string, string | number> = {
  fontSize: '11px',
  color: '#888',
  padding: '8px 16px 4px',
  textTransform: 'uppercase',
  fontWeight: 500
};

const queueItemStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  borderBottom: '1px solid #f0f0f0',
  cursor: 'pointer',
  transition: 'background 0.15s ease'
};
