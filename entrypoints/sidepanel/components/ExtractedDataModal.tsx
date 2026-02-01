import { useSignal } from '@preact/signals';
import { X, Copy, Check, Table, Code } from 'lucide-preact';

interface ExtractedDataModalProps {
  data: Record<string, unknown>;
  scriptName: string;
  isOpen: boolean;
  onClose: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}

type ViewMode = 'table' | 'json';

export function ExtractedDataModal({
  data,
  scriptName,
  isOpen,
  onClose,
  onExportJSON,
  onExportCSV
}: ExtractedDataModalProps) {
  const viewMode = useSignal<ViewMode>('table');
  const copiedKey = useSignal<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (key: string, value: unknown) => {
    const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => { copiedKey.value = null; }, 2000);
  };

  const entries = Object.entries(data);
  const hasData = entries.length > 0;

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={(e: Event) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyles}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
            {chrome.i18n.getMessage('extractedData') || 'Extracted Data'}
          </h3>
          <button onClick={onClose} style={closeButtonStyles}>
            <X size={18} />
          </button>
        </div>

        {/* Script name */}
        <div style={{ padding: '0 16px', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
          {scriptName}
        </div>

        {/* View toggle */}
        <div style={toggleContainerStyles}>
          <button
            onClick={() => viewMode.value = 'table'}
            style={viewMode.value === 'table' ? activeToggleStyles : toggleStyles}
          >
            <Table size={14} />
            {chrome.i18n.getMessage('tableView') || 'Table'}
          </button>
          <button
            onClick={() => viewMode.value = 'json'}
            style={viewMode.value === 'json' ? activeToggleStyles : toggleStyles}
          >
            <Code size={14} />
            JSON
          </button>
        </div>

        {/* Content */}
        <div style={contentStyles}>
          {!hasData ? (
            <div style={emptyStyles}>
              {chrome.i18n.getMessage('noExtractedData') || 'No data extracted yet'}
            </div>
          ) : viewMode.value === 'table' ? (
            <TableView
              entries={entries}
              copiedKey={copiedKey.value}
              onCopy={copyToClipboard}
            />
          ) : (
            <JSONView data={data} />
          )}
        </div>

        {/* Export buttons */}
        {hasData && (
          <div style={footerStyles}>
            <button onClick={onExportJSON} style={exportButtonStyles}>
              {chrome.i18n.getMessage('exportJSON') || 'Export JSON'}
            </button>
            <button onClick={onExportCSV} style={exportButtonStyles}>
              {chrome.i18n.getMessage('exportCSV') || 'Export CSV'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components for table and JSON views
interface TableViewProps {
  entries: [string, unknown][];
  copiedKey: string | null;
  onCopy: (key: string, value: unknown) => void;
}

function TableView({ entries, copiedKey, onCopy }: TableViewProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      {entries.map(([key, value]) => {
        // Check if value is table data (array of objects)
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          return <TableDataView key={key} name={key} data={value as Record<string, string>[]} />;
        }
        // Simple key-value
        return (
          <div key={key} style={rowStyles}>
            <span style={keyStyles}>{key.replace('extracted.', '')}</span>
            <span style={valueStyles}>{String(value)}</span>
            <button
              onClick={() => onCopy(key, value)}
              style={copyButtonStyles}
              title={chrome.i18n.getMessage('copyToClipboard') || 'Copy'}
            >
              {copiedKey === key ? <Check size={14} color="#4caf50" /> : <Copy size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TableDataView({ name, data }: { name: string; data: Record<string, string>[] }) {
  if (data.length === 0) return null;
  const headers = Object.keys(data[0]);

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontWeight: 500, marginBottom: '8px', fontSize: '13px', color: '#333' }}>
        {name.replace('extracted.', '')}
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={thStyles}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                {headers.map(h => (
                  <td key={h} style={tdStyles}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JSONView({ data }: { data: Record<string, unknown> }) {
  return (
    <pre style={jsonStyles}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// Styles
const overlayStyles: Record<string, string> = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: '9999'
};

const modalStyles: Record<string, string> = {
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  maxWidth: '32rem',
  width: 'calc(100% - 32px)',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  margin: '16px'
};

const headerStyles: Record<string, string> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  borderBottom: '1px solid #f0f0f0'
};

const closeButtonStyles: Record<string, string> = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#8e8e93',
  padding: '4px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const toggleContainerStyles: Record<string, string> = {
  display: 'flex',
  gap: '4px',
  padding: '0 16px',
  marginBottom: '8px'
};

const toggleStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  fontSize: '12px',
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: '4px',
  cursor: 'pointer',
  color: '#666'
};

const activeToggleStyles: Record<string, string> = {
  ...toggleStyles,
  background: '#007AFF',
  borderColor: '#007AFF',
  color: 'white'
};

const contentStyles: Record<string, string> = {
  flex: '1',
  overflowY: 'auto',
  padding: '16px',
  minHeight: '100px'
};

const emptyStyles: Record<string, string> = {
  textAlign: 'center',
  padding: '32px',
  color: '#999',
  fontSize: '14px'
};

const footerStyles: Record<string, string> = {
  display: 'flex',
  gap: '8px',
  padding: '16px',
  borderTop: '1px solid #f0f0f0',
  justifyContent: 'flex-end'
};

const exportButtonStyles: Record<string, string> = {
  padding: '8px 16px',
  fontSize: '13px',
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#333'
};

const rowStyles: Record<string, string> = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #f0f0f0',
  gap: '12px'
};

const keyStyles: Record<string, string> = {
  fontWeight: '500',
  fontSize: '13px',
  color: '#333',
  minWidth: '120px',
  flexShrink: '0'
};

const valueStyles: Record<string, string> = {
  flex: '1',
  fontSize: '13px',
  color: '#666',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const copyButtonStyles: Record<string, string> = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#8e8e93',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0'
};

const thStyles: Record<string, string> = {
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #e0e0e0',
  background: '#f5f5f5',
  fontWeight: '500',
  color: '#333'
};

const tdStyles: Record<string, string> = {
  padding: '8px 12px',
  borderBottom: '1px solid #f0f0f0',
  color: '#666'
};

const jsonStyles: Record<string, string> = {
  background: '#f8f8f8',
  padding: '16px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'monospace',
  overflow: 'auto',
  margin: '0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
};
