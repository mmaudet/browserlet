/**
 * Screenshot gallery component for Browserlet
 * Displays thumbnail grid of screenshots in execution history
 * Red border on failure screenshots, click to expand
 */

import { useSignal } from '@preact/signals';
import { Image, Download, AlertCircle } from 'lucide-preact';
import type { ScreenshotRecord } from '../../../utils/types';
import { ScreenshotModal } from './ScreenshotModal';
import { downloadScreenshot, downloadAllScreenshots } from '../../../utils/export/screenshotExport';

interface ScreenshotGalleryProps {
  screenshots: ScreenshotRecord[];
  scriptName: string;
}

export function ScreenshotGallery({ screenshots, scriptName }: ScreenshotGalleryProps) {
  const selectedScreenshot = useSignal<ScreenshotRecord | null>(null);

  if (screenshots.length === 0) {
    return (
      <div style={emptyStyles}>
        <Image size={24} color="#9e9e9e" />
        <span>{chrome.i18n.getMessage('noScreenshots') || 'No screenshots'}</span>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Header with download all button */}
      <div style={headerStyles}>
        <span style={titleStyles}>
          {chrome.i18n.getMessage('screenshots') || 'Screenshots'} ({screenshots.length})
        </span>
        <button
          onClick={() => downloadAllScreenshots(screenshots, scriptName)}
          style={downloadAllButtonStyles}
          title={chrome.i18n.getMessage('downloadAllScreenshots') || 'Download all as ZIP'}
        >
          <Download size={14} />
          {chrome.i18n.getMessage('downloadAll') || 'Download All'}
        </button>
      </div>

      {/* Thumbnail grid */}
      <div style={gridStyles}>
        {screenshots.map((screenshot) => (
          <div
            key={screenshot.id}
            onClick={() => selectedScreenshot.value = screenshot}
            style={{
              ...thumbnailContainerStyles,
              ...(screenshot.isFailure ? failureBorderStyles : {})
            }}
            title={`${chrome.i18n.getMessage('step') || 'Step'} ${screenshot.stepIndex}${screenshot.isFailure ? ` (${chrome.i18n.getMessage('failure') || 'failure'})` : ''}`}
          >
            <img
              src={screenshot.dataUrl}
              alt={`Step ${screenshot.stepIndex}`}
              style={thumbnailImageStyles}
            />
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
        ))}
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
