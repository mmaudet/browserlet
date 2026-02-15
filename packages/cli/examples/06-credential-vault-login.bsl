# 06 - Credential Vault Login
#
# Demonstrates: credential vault syntax with {{credential:alias}}
# Hint types used: name, type, role
#
# SETUP REQUIRED:
#   1. Initialize vault:  browserlet vault init
#   2. Add credentials:   browserlet vault add --alias username --value "myuser"
#                          browserlet vault add --alias password --value "mypass"
#   3. Run with --vault:  browserlet run --vault examples/06-credential-vault-login.bsl
#
# The --vault flag prompts for the master password to decrypt credentials.
# Credential values are NEVER printed in logs (redacted automatically).

name: Login with vault credentials
steps:
  # Step 1: Navigate to a login page
  - action: navigate
    value: "https://httpbin.org/forms/post"

  # Step 2: Type the username from the vault
  # {{credential:username}} is resolved at runtime from the encrypted vault
  - action: type
    target:
      intent: "Username or name input field"
      hints:
        - type: name
          value: custname
      fallback_selector: "input[name='custname']"
    value: "{{credential:username}}"

  # Step 3: Type the password from the vault
  # {{credential:password}} is also resolved from the vault
  - action: type
    target:
      intent: "Password or email input field"
      hints:
        - type: name
          value: custemail
        - type: type
          value: email
      fallback_selector: "input[name='custemail']"
    value: "{{credential:password}}"

  # Step 4: Submit the form
  - action: click
    target:
      intent: "Submit button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Submit"
      fallback_selector: "button[type='submit']"
