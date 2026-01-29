import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';

// Import YAML language contribution
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';

let configured = false;

// Configure Monaco YAML support (call once at app startup)
export function setupMonaco(): void {
  if (configured) return;

  configureMonacoYaml(monaco, {
    validate: true,
    format: true,
    hover: true,
    completion: true,
    schemas: [{
      uri: 'bsl://schema',
      fileMatch: ['*'],
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Script name' },
          description: { type: 'string', description: 'Script description' },
          version: { type: 'string', description: 'Script version' },
          target_app: { type: 'string', description: 'Target application' },
          steps: {
            type: 'array',
            description: 'List of automation steps',
            items: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['click', 'type', 'select', 'extract', 'wait_for', 'navigate', 'scroll', 'hover']
                },
                target: { type: 'object' },
                value: { type: 'string' }
              }
            }
          }
        },
        required: ['name', 'steps']
      }
    }]
  });

  configured = true;
}

export { monaco };
