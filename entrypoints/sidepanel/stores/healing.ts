/**
 * Healing store with reactive state for managing repair suggestions
 * Covers requirements: HEAL-02, HEAL-03, HEAL-08, HEAL-09
 */

import { signal, computed } from '@preact/signals';
import type { SemanticHint } from '../../../entrypoints/content/playback/types';

/**
 * Repair suggestion from LLM for a failed element resolution
 */
export interface RepairSuggestion {
  /** Unique identifier */
  id: string;
  /** Step index in the script (0-based) */
  stepIndex: number;
  /** Script ID */
  scriptId: string;
  /** Script name for display */
  scriptName: string;
  /** Original hints that failed */
  originalHints: SemanticHint[];
  /** LLM-suggested alternative hints (multiple candidates) */
  proposedHints: SemanticHint[];
  /** Confidence in this suggestion (0-1) */
  confidence: number;
  /** Explanation of why these hints should work */
  reason: string;
  /** DOM excerpt around expected element location */
  domExcerpt: string;
  /** Page URL where resolution failed */
  pageUrl: string;
  /** Page title */
  pageTitle: string;
  /** When the suggestion was created */
  createdAt: number;
  /** Current status in the repair workflow */
  status: 'pending' | 'testing' | 'approved' | 'rejected';
}

// ============================================================================
// Signals
// ============================================================================

/** Queue of repair suggestions awaiting user review */
export const repairQueue = signal<RepairSuggestion[]>([]);

/** Currently active/selected repair suggestion */
export const activeRepair = signal<RepairSuggestion | null>(null);

/** Flag indicating healing is in progress */
export const isHealingInProgress = signal(false);

/** Error message from healing operation */
export const healingError = signal<string | null>(null);

// ============================================================================
// Computed
// ============================================================================

/** Whether there are pending repairs awaiting review */
export const hasPendingRepairs = computed(() =>
  repairQueue.value.some(r => r.status === 'pending')
);

/** Count of pending repairs */
export const pendingCount = computed(() =>
  repairQueue.value.filter(r => r.status === 'pending').length
);

// ============================================================================
// Actions
// ============================================================================

/**
 * Generate a UUID for repair suggestions
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Add a new repair suggestion to the queue
 * @param suggestion - Partial suggestion without id, createdAt, status
 */
export function addRepairSuggestion(
  suggestion: Omit<RepairSuggestion, 'id' | 'createdAt' | 'status'>
): void {
  const newSuggestion: RepairSuggestion = {
    ...suggestion,
    id: generateUUID(),
    createdAt: Date.now(),
    status: 'pending',
  };

  repairQueue.value = [...repairQueue.value, newSuggestion];

  // Auto-select as active if it's the first pending repair
  if (activeRepair.value === null) {
    activeRepair.value = newSuggestion;
  }

  console.log('[healing store] Added repair suggestion:', newSuggestion.id);
}

/**
 * Set the active repair by ID
 * @param id - Repair ID to activate, or null to clear
 */
export function setActiveRepair(id: string | null): void {
  if (id === null) {
    activeRepair.value = null;
    return;
  }

  const repair = repairQueue.value.find(r => r.id === id);
  if (repair) {
    activeRepair.value = repair;
    console.log('[healing store] Active repair set to:', id);
  } else {
    console.warn('[healing store] Repair not found:', id);
  }
}

/**
 * Update the status of a repair suggestion
 * @param id - Repair ID
 * @param status - New status
 */
export function updateRepairStatus(
  id: string,
  status: RepairSuggestion['status']
): void {
  repairQueue.value = repairQueue.value.map(repair =>
    repair.id === id ? { ...repair, status } : repair
  );

  // Update active repair if it matches
  if (activeRepair.value?.id === id) {
    activeRepair.value = { ...activeRepair.value, status };
  }

  console.log('[healing store] Updated repair status:', id, status);
}

/**
 * Update the proposed hints for a repair (for user edits)
 * @param id - Repair ID
 * @param hints - New proposed hints
 */
export function updateProposedHints(
  id: string,
  hints: SemanticHint[]
): void {
  repairQueue.value = repairQueue.value.map(repair =>
    repair.id === id ? { ...repair, proposedHints: hints } : repair
  );

  // Update active repair if it matches
  if (activeRepair.value?.id === id) {
    activeRepair.value = { ...activeRepair.value, proposedHints: hints };
  }

  console.log('[healing store] Updated proposed hints for:', id);
}

/**
 * Remove a repair suggestion from the queue
 * @param id - Repair ID to remove
 */
export function removeRepair(id: string): void {
  repairQueue.value = repairQueue.value.filter(repair => repair.id !== id);

  // Clear active repair if it was removed
  if (activeRepair.value?.id === id) {
    // Auto-select next pending repair if available
    const nextPending = repairQueue.value.find(r => r.status === 'pending');
    activeRepair.value = nextPending || null;
  }

  console.log('[healing store] Removed repair:', id);
}

/**
 * Clear all repair suggestions
 */
export function clearAllRepairs(): void {
  repairQueue.value = [];
  activeRepair.value = null;
  healingError.value = null;
  console.log('[healing store] Cleared all repairs');
}

// ============================================================================
// Message Listeners (called from sidepanel main)
// ============================================================================

/**
 * Initialize healing message listeners
 * Call this from sidepanel main.tsx
 */
export function initializeHealingListeners(): void {
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'HEALING_STARTED': {
        // LLM is working on a suggestion
        isHealingInProgress.value = true;
        healingError.value = null;
        break;
      }

      case 'HEALING_SUGGESTION': {
        const payload = message.payload as {
          stepIndex: number;
          scriptId: string;
          scriptName: string;
          originalHints: SemanticHint[];
          proposedHints: SemanticHint[];
          confidence: number;
          reason: string;
          domExcerpt: string;
          pageUrl: string;
          pageTitle: string;
        };

        addRepairSuggestion(payload);
        isHealingInProgress.value = false;
        break;
      }

      case 'TEST_REPAIR_RESULT': {
        const { repairId, success } = message.payload as {
          repairId: string;
          success: boolean;
        };

        // 'approved' status means test passed and ready for user to apply
        // The actual fix is applied when user clicks "Apply Fix"
        updateRepairStatus(repairId, success ? 'approved' : 'pending');

        if (!success) {
          healingError.value = 'Test failed: element not found with proposed hints';
        } else {
          // Clear any previous error on success
          healingError.value = null;
        }
        break;
      }

      case 'HEALING_ERROR': {
        const { error } = message.payload as { error: string };
        healingError.value = error;
        isHealingInProgress.value = false;
        break;
      }
    }
  });

  console.log('[healing store] Message listeners initialized');
}
