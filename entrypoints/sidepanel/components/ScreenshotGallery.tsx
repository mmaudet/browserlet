/**
 * Screenshot gallery component for Browserlet
 * Displays thumbnail grid of screenshots in execution history
 * Red border on failure screenshots, click to expand
 * Selection mode for batch deletion
 */

import { useSignal } from '@preact/signals';
import { Image, Download, AlertCircle, Trash2, Check } from 'lucide-preact';
import type { ScreenshotRecord } from '../../../utils/types';
import { ScreenshotModal } from './ScreenshotModal';
import { downloadScreenshot, downloadAllScreenshots } from '../../../utils/export/screenshotExport';
import { deleteScreenshot } from '../../../utils/storage/screenshots';

interface ScreenshotGalleryProps {
  screenshots: ScreenshotRecord[];
  scriptName: string;
  onDeleted?: () => void; // Callback to refresh after deletion
}

export function ScreenshotGallery({ screenshots, scriptName, onDeleted }: ScreenshotGalleryProps) {
  const selectedScreenshot = useSignal<ScreenshotRecord | null>(null);
  const selectedForDeletion = useSignal<Set<string>>(new Set());
  const isDeleting = useSignal(false);

  if (screenshots.length === 0) {
    return (
      <div style={emptyStyles}>
        <Image size={24} color="#9e9e9e" />
        <span>{chrome.i18n.getMessage('noScreenshots') || 'No screenshots'}</span>
      </div>
    );
  }

  const toggleSelection = (id: string, e: Event) => {
    e.stopPropagation();
    const newSet = new Set(selectedForDeletion.value);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedForDeletion.value = newSet;
  };

  const handleDelete = async () => {
    const count = selectedForDeletion.value.size;
    if (count === 0) return;

    const confirmMsg = chrome.i18n.getMessage('confirmDeleteScreenshots', [String(count)]) ||
      `Delete ${count} screenshot${count > 1 ? 's' : ''}?`;

    if (!confirm(confirmMsg)) return;

    isDeleting.value = true;
    try {
      // Delete all selected screenshots
      for (const id of selectedForDeletion.value) {
        const screenshot = screenshots.find(s => s.id === id);
        if (screenshot) {
          await deleteScreenshot(screenshot.scriptId, id);
        }
      }
      selectedForDeletion.value = new Set();
      onDeleted?.();
    } catch (error) {
      console.error('[Browserlet] Failed to delete screenshots:', error);
    } finally {
      isDeleting.value = false;
    }
  };

  const selectionCount = selectedForDeletion.value.size;

  return (
    <div style={containerStyles}>
      {/* Header with actions */}
      <div style={headerStyles}>
        <span style={titleStyles}>
          {chrome.i18n.getMessage('screenshots') || 'Screenshots'} ({screenshots.length})
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Delete button with badge */}
          <button
            onClick={handleDelete}
            disabled={selectionCount === 0 || isDeleting.value}
            style={{
              ...deleteButtonStyles,
              opacity: selectionCount === 0 ? 0.5 : 1,
              cursor: selectionCount === 0 ? 'default' : 'pointer'
            }}
            title={chrome.i18n.getMessage('deleteSelected') || 'Delete selected'}
          >
            <Trash2 size={14} />
            {selectionCount > 0 && (
              <span style={deleteBadgeStyles}>{selectionCount}</span>
            )}
          </button>
          {/* Download all button */}
          <button
            onClick={() => downloadAllScreenshots(screenshots, scriptName)}
            style={downloadAllButtonStyles}
            title={chrome.i18n.getMessage('downloadAllScreenshots') || 'Download all as ZIP'}
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div style={gridStyles}>
        {screenshots.map((screenshot) => {
          const isSelected = selectedForDeletion.value.has(screenshot.id);
          return (
            <div
              key={screenshot.id}
              onClick={() => selectedScreenshot.value = screenshot}
              style={{
                ...thumbnailContainerStyles,
                ...(screenshot.isFailure ? failureBorderStyles : {}),
                ...(isSelected ? selectedBorderStyles : {})
              }}
              title={`${chrome.i18n.getMessage('step') || 'Step'} ${screenshot.stepIndex}${screenshot.isFailure ? ` (${chrome.i18n.getMessage('failure') || 'failure'})` : ''}`}
            >
              <img
                src={screenshot.dataUrl}
                alt={`Step ${screenshot.stepIndex}`}
                style={thumbnailImageStyles}
              />
              {/* Selection checkbox */}
              <div
                onClick={(e: Event) => toggleSelection(screenshot.id, e)}
                style={{
                  ...checkboxStyles,
                  background: isSelected ? '#007AFF' : 'rgba(255,255,255,0.9)',
                  border: isSelected ? 'none' : '1px solid #ccc'
                }}
              >
                {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
              </div>
              {/* Step badge */}
              <div style={stepBadgeStyles}>
                {screenshot.stepIndex}
              </div>
              {/* Failure indicator */}
              {screenshot.isFailure && (
                <div style={failureIndicatorStyles}>
                  <AlertCircle size={12} color="#fff" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screenshot modal */}
      <ScreenshotModal
        screenshot={selectedScreenshot.value}
        scriptName={scriptName}
        isOpen={selectedScreenshot.value !== null}
        onClose={() => selectedScreenshot.value = null}
        onDownload={() => {
          if (selectedScreenshot.value) {
            downloadScreenshot(selectedScreenshot.value, scriptName);
          }
        }}
      />
    </div>
  );
}

// Styles
const containerStyles: Record<string, string> = {
  marginTop: '12px'
};

const headerStyles: Record<string, string> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px'
};

const titleStyles: Record<string, string> = {
  fontSize: '13px',
  fontWeight: '500',
  color: '#333'
};

const downloadAllButtonStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  fontSize: '11px',
  background: '#f5f5f5',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  cursor: 'pointer'
};

const gridStyles: Record<string, string> = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: '8px'
};

const thumbnailContainerStyles: Record<string, string> = {
  position: 'relative',
  aspectRatio: '16/9',
  borderRadius: '4px',
  overflow: 'hidden',
  cursor: 'pointer',
  border: '2px solid #e0e0e0'
};

const failureBorderStyles: Record<string, string> = {
  border: '2px solid #f44336'
};

const selectedBorderStyles: Record<string, string> = {
  border: '2px solid #007AFF',
  boxShadow: '0 0 0 2px rgba(0,122,255,0.3)'
};

const deleteButtonStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  padding: '4px 8px',
  background: '#fff5f5',
  border: '1px solid #ffcdd2',
  borderRadius: '4px',
  color: '#d32f2f'
};

const deleteBadgeStyles: Record<string, string> = {
  position: 'absolute',
  top: '-6px',
  right: '-6px',
  background: '#d32f2f',
  color: '#fff',
  fontSize: '9px',
  fontWeight: '600',
  minWidth: '14px',
  height: '14px',
  borderRadius: '7px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 3px'
};

const checkboxStyles: Record<string, string> = {
  position: 'absolute',
  top: '4px',
  left: '4px',
  width: '16px',
  height: '16px',
  borderRadius: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: '1'
};

const thumbnailImageStyles: Record<string, string> = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const stepBadgeStyles: Record<string, string> = {
  position: 'absolute',
  bottom: '4px',
  left: '4px',
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  padding: '2px 6px',
  borderRadius: '3px',
  fontSize: '10px',
  fontWeight: '500'
};

const failureIndicatorStyles: Record<string, string> = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  background: '#f44336',
  borderRadius: '50%',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const emptyStyles: Record<string, string> = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  padding: '16px',
  color: '#9e9e9e',
  fontSize: '12px'
};
