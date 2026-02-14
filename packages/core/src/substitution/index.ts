export {
  substituteVariables,
  extractVariableRefs,
  hasExtractedVariables,
  EXTRACTED_VAR_PATTERN,
} from './variables.js';
export {
  extractCredentialRefs,
  substituteCredentials,
  CREDENTIAL_PATTERN,
} from './credentials.js';
export type {
  CredentialReference,
  PasswordStorage,
  StoredPasswordRef,
} from './credentials.js';
