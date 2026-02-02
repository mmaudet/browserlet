/**
 * Screenshot modal component for Browserlet
 * Full-size screenshot viewer with metadata and download button
 */

import { X, Download, ExternalLink, Clock, AlertTriangle } from 'lucide-preact';
import type { ScreenshotRecord } from '../../../utils/types';

interface ScreenshotModalProps {
  screenshot: ScreenshotRecord | null;
  scriptName: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export function ScreenshotModal({
  screenshot,
  isOpen,
  onClose,
  onDownload
}: ScreenshotModalProps) {
  if (!isOpen || !screenshot) return null;

  const formattedTime = new Date(screenshot.timestamp).toLocaleString();

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={(e: Event) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyles}>
          <div style={titleContainerStyles}>
            <span style={titleStyles}>
              {chrome.i18n.getMessage('step') || 'Step'} {screenshot.stepIndex}
              {screenshot.isFailure && (
                <span style={failureBadgeStyles}>
                  <AlertTriangle size={12} />
                  {chrome.i18n.getMessage('failure') || 'Failure'}
                </span>
              )}
            </span>
          </div>
          <div style={headerActionsStyles}>
            <button onClick={onDownload} style={iconButtonStyles} title={chrome.i18n.getMessage('downloadPNG') || 'Download PNG'}>
              <Download size={18} />
            </button>
            <button onClick={onClose} style={iconButtonStyles}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Screenshot image */}
        <div style={imageContainerStyles}>
          <img
            src={screenshot.dataUrl}
            alt={`Screenshot step ${screenshot.stepIndex}`}
            style={imageStyles}
          />
        </div>

        {/* Metadata footer */}
        <div style={metadataStyles}>
          <div style={metaItemStyles}>
            <Clock size={12} />
            <span>{formattedTime}</span>
          </div>
          <div style={metaItemStyles}>
            <ExternalLink size={12} />
            <span style={urlStyles} title={screenshot.pageUrl}>
              {screenshot.pageTitle || screenshot.pageUrl}
            </span>
          </div>
          {screenshot.isFailure && screenshot.failureReason && (
            <div style={errorStyles}>
              <AlertTriangle size={12} />
              <span>{screenshot.failureReason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styles
const overlayStyles: Record<string, string> = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: '1000',
  padding: '16px'
};

const modalStyles: Record<string, string> = {
  background: '#fff',
  borderRadius: '8px',
  maxWidth: '90vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
};

const headerStyles: Record<string, string> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0'
};

const titleContainerStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const titleStyles: Record<string, string> = {
  fontSize: '16px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const failureBadgeStyles: Record<string, string> = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  background: '#ffebee',
  color: '#c62828',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: '500'
};

const headerActionsStyles: Record<string, string> = {
  display: 'flex',
  gap: '8px'
};

const iconButtonStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  background: 'none',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#666'
};

const imageContainerStyles: Record<string, string> = {
  flex: '1',
  overflow: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f5f5',
  padding: '8px'
};

const imageStyles: Record<string, string> = {
  maxWidth: '100%',
  maxHeight: '60vh',
  objectFit: 'contain',
  borderRadius: '4px'
};

const metadataStyles: Record<string, string> = {
  padding: '12px 16px',
  borderTop: '1px solid #e0e0e0',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '12px',
  color: '#666'
};

const metaItemStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};

const urlStyles: Record<string, string> = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '400px'
};

const errorStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
  color: '#c62828',
  background: '#ffebee',
  padding: '8px',
  borderRadius: '4px',
  marginTop: '4px'
};
