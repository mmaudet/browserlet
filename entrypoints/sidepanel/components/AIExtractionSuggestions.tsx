import { useSignal } from '@preact/signals';
import { Sparkles, Edit2, X } from 'lucide-preact';
import type { ExtractionSuggestion } from '../../background/llm/prompts/extractionPrompt';

interface AIExtractionSuggestionsProps {
  suggestions: ExtractionSuggestion[];
  isLoading: boolean;
  onAccept: (selected: ExtractionSuggestion[]) => void;
  onCancel: () => void;
}

export function AIExtractionSuggestions({
  suggestions,
  isLoading,
  onAccept,
  onCancel
}: AIExtractionSuggestionsProps) {
  // Track selected suggestions and edited names
  const selected = useSignal<Set<number>>(new Set());
  const editedNames = useSignal<Map<number, string>>(new Map());
  const editingIndex = useSignal<number | null>(null);

  const toggleSelect = (index: number) => {
    const newSet = new Set(selected.value);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    selected.value = newSet;
  };

  const handleNameEdit = (index: number, name: string) => {
    const newMap = new Map(editedNames.value);
    newMap.set(index, name);
    editedNames.value = newMap;
  };

  const handleAccept = () => {
    const selectedSuggestions = suggestions
      .map((s, i) => ({
        ...s,
        variableName: editedNames.value.get(i) || s.variableName
      }))
      .filter((_, i) => selected.value.has(i));
    onAccept(selectedSuggestions);
  };

  if (isLoading) {
    return (
      <div style={loadingStyles}>
        <div style={spinnerContainerStyles}>
          <Sparkles size={20} style={{ color: '#4285f4' }} />
        </div>
        <span style={{ color: '#666', fontSize: '13px' }}>
          {chrome.i18n.getMessage('analyzingPage') || 'Analyzing page...'}
        </span>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div style={emptyStyles}>
        <p style={{ margin: '0 0 12px 0', color: '#666' }}>
          {chrome.i18n.getMessage('noSuggestionsFound') || 'No extraction suggestions found on this page'}
        </p>
        <button onClick={onCancel} style={cancelButtonStyles}>
          {chrome.i18n.getMessage('close') || 'Close'}
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: '#4285f4' }} />
          <span style={{ fontWeight: 500 }}>
            {chrome.i18n.getMessage('aiSuggestions') || 'AI Suggestions'}
          </span>
        </div>
        <button onClick={onCancel} style={closeIconStyles} title={chrome.i18n.getMessage('close') || 'Close'}>
          <X size={16} />
        </button>
      </div>

      <div style={listStyles}>
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            style={{
              ...itemStyles,
              background: selected.value.has(index) ? '#e3f2fd' : 'white'
            }}
            onClick={() => toggleSelect(index)}
          >
            <input
              type="checkbox"
              checked={selected.value.has(index)}
              onChange={() => toggleSelect(index)}
              onClick={(e) => e.stopPropagation()}
              style={{ marginRight: '10px', cursor: 'pointer' }}
            />
            <div style={itemContentStyles}>
              <div style={nameRowStyles}>
                {editingIndex.value === index ? (
                  <input
                    type="text"
                    value={editedNames.value.get(index) ?? suggestion.variableName}
                    onChange={(e) => handleNameEdit(index, (e.target as HTMLInputElement).value)}
                    onBlur={() => editingIndex.value = null}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') editingIndex.value = null;
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={nameInputStyles}
                  />
                ) : (
                  <span
                    style={nameStyles}
                    onClick={(e) => {
                      e.stopPropagation();
                      editingIndex.value = index;
                    }}
                    title={chrome.i18n.getMessage('edit') || 'Edit'}
                  >
                    {editedNames.value.get(index) ?? suggestion.variableName}
                    <Edit2 size={12} style={{ marginLeft: '4px', opacity: 0.5 }} />
                  </span>
                )}
              </div>
              <span style={valueStyles}>"{suggestion.displayValue}"</span>
              {suggestion.suggestedTransform && (
                <span style={transformStyles}>{suggestion.suggestedTransform}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={footerStyles}>
        <button onClick={onCancel} style={cancelButtonStyles}>
          {chrome.i18n.getMessage('cancel') || 'Cancel'}
        </button>
        <button
          onClick={handleAccept}
          disabled={selected.value.size === 0}
          style={{
            ...acceptButtonStyles,
            opacity: selected.value.size === 0 ? 0.5 : 1,
            cursor: selected.value.size === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {chrome.i18n.getMessage('addSelected') || 'Add Selected'} ({selected.value.size})
        </button>
      </div>
    </div>
  );
}

// Styles
const containerStyles: Record<string, string | number> = {
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  marginBottom: '16px',
  overflow: 'hidden'
};

const headerStyles: Record<string, string | number> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #e0e0e0',
  background: '#f8f9fa'
};

const closeIconStyles: Record<string, string | number> = {
  background: 'none',
  border: 'none',
  padding: '4px',
  cursor: 'pointer',
  color: '#666',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const listStyles: Record<string, string | number> = {
  maxHeight: '250px',
  overflowY: 'auto'
};

const itemStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '10px 16px',
  borderBottom: '1px solid #f0f0f0',
  cursor: 'pointer',
  transition: 'background 0.15s ease'
};

const itemContentStyles: Record<string, string | number> = {
  flex: 1,
  minWidth: 0
};

const nameRowStyles: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '4px'
};

const nameStyles: Record<string, string | number> = {
  fontWeight: 500,
  color: '#1a73e8',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '13px'
};

const nameInputStyles: Record<string, string | number> = {
  fontWeight: 500,
  color: '#1a73e8',
  border: '1px solid #1a73e8',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: '13px',
  width: '150px',
  outline: 'none'
};

const valueStyles: Record<string, string | number> = {
  fontSize: '12px',
  color: '#666',
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const transformStyles: Record<string, string | number> = {
  fontSize: '10px',
  color: '#888',
  background: '#f0f0f0',
  padding: '2px 6px',
  borderRadius: '4px',
  marginTop: '4px',
  display: 'inline-block'
};

const footerStyles: Record<string, string | number> = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  borderTop: '1px solid #e0e0e0',
  background: '#f8f9fa'
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

const acceptButtonStyles: Record<string, string | number> = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '6px',
  background: '#4285f4',
  color: 'white',
  fontSize: '13px',
  fontWeight: 500
};

const loadingStyles: Record<string, string | number> = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '32px 16px',
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  marginBottom: '16px'
};

const spinnerContainerStyles: Record<string, string | number> = {
  animation: 'pulse 1.5s ease-in-out infinite'
};

const emptyStyles: Record<string, string | number> = {
  textAlign: 'center',
  padding: '24px 16px',
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  marginBottom: '16px'
};
