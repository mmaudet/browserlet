import { signal } from '@preact/signals';
import { render } from 'preact';

// Local signal for component state
const counter = signal(0);

export function PreactTest() {
  return (
    <div style={{
      padding: '12px',
      margin: '8px',
      border: '1px dashed #4285f4',
      borderRadius: '4px',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        Preact Test Component
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => counter.value--}
          style={{
            padding: '4px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          -
        </button>
        <span style={{ minWidth: '40px', textAlign: 'center' }}>
          {counter.value}
        </span>
        <button
          onClick={() => counter.value++}
          style={{
            padding: '4px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// Helper to mount the component into a container
export function mountPreactTest(container: HTMLElement) {
  render(<PreactTest />, container);
}
