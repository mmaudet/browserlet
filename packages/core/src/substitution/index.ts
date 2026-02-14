export {
  substituteVariables,
  extractVariableRefs,
  hasExtractedVariables,
  EXTRACTED_VAR_PATTERN,
} from './variables';
export {
  extractCredentialRefs,
  substituteCredentials,
  CREDENTIAL_PATTERN,
} from './credentials';
export type {
  CredentialReference,
  PasswordStorage,
  StoredPasswordRef,
} from './credentials';
