# OBM Legacy Pipeline Validation
#
# Target: extranet.linagora.com/obm (HTML table-based legacy ERP)
# Purpose: Validate the record-generate-execute pipeline against legacy HTML
# with table layouts, form-based auth, and traditional server-rendered pages.
#
# Prerequisites:
#   1. Vault initialized: browserlet vault init
#   2. Credentials stored: browserlet vault add obm_username
#                          browserlet vault add obm_password
#   3. Run with: browserlet run --vault --headed --timeout 30000 \
#                  --output-dir browserlet-output/validation \
#                  .planning/phases/040-pipeline-validation/validation-scripts/obm-legacy-workflow.bsl
#
# Session persistence: After first successful login, the session snapshot
# is saved so subsequent runs can skip the login flow.

name: OBM Legacy Pipeline Validation
session_persistence:
  enabled: true
  snapshot_id: "obm-validation"
steps:
  # Step 1: Navigate to OBM login page
  - action: navigate
    value: "https://extranet.linagora.com/obm"

  # Step 2: Wait for the login form to render
  # OBM uses a traditional HTML form with named input fields
  - action: wait_for
    target:
      intent: "Login username field"
      hints:
        - type: name
          value: login
        - type: type
          value: text
      fallback_selector: "input[name='login']"
    timeout: "15s"

  # Step 3: Enter username from the credential vault
  - action: type
    target:
      intent: "Login username field"
      hints:
        - type: name
          value: login
        - type: type
          value: text
      fallback_selector: "input[name='login']"
    value: "{{credential:obm_username}}"

  # Step 4: Enter password from the credential vault
  - action: type
    target:
      intent: "Login password field"
      hints:
        - type: name
          value: password
        - type: type
          value: password
      fallback_selector: "input[name='password']"
    value: "{{credential:obm_password}}"

  # Step 5: Click the login/submit button
  # OBM login form uses a submit input or button labeled "Connexion"
  - action: click
    target:
      intent: "Login submit button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Connexion"
      fallback_selector: "input[type='submit'], button[type='submit']"

  # Step 6: Wait for the main navigation to appear after login
  # OBM renders a navigation bar or table-based nav after successful auth
  - action: wait_for
    target:
      intent: "OBM main navigation area after login"
      hints:
        - type: role
          value: navigation
        - type: landmark_context
          value: navigation
      fallback_selector: "#main-nav, .obm-nav, table.navigation, #bannerLeft, #calendarNavigation"
    timeout: "20s"

  # Step 7: Take a screenshot to capture post-login dashboard
  - action: screenshot

  # Step 8: Navigate to the Contacts module
  # OBM typically has a top-level nav with links to modules
  - action: click
    target:
      intent: "Contacts module link in the main navigation"
      hints:
        - type: role
          value: link
        - type: text_contains
          value: "Contacts"
      fallback_selector: "a[href*='contact']"

  # Step 9: Wait for the contacts page to load
  # Contacts page should show a heading or a listing table
  - action: wait_for
    target:
      intent: "Contacts page content area"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "Contact"
      fallback_selector: "h1, .page-title, table.listingTable, #contentTable"
    timeout: "15s"

  # Step 10: Extract data from the contacts listing
  # Target the first data cell in the contacts table
  - action: extract
    target:
      intent: "First contact entry in the contacts listing table"
      hints:
        - type: role
          value: cell
      fallback_selector: "table.listingTable tr:nth-child(2) td:first-child, table tbody tr:first-child td:first-child"
    output:
      variable: "extracted.first_contact"

  # Step 11: Take a screenshot of the contacts page
  - action: screenshot

  # Step 12: Navigate to the Calendar/Agenda module
  - action: click
    target:
      intent: "Calendar or Agenda module link in navigation"
      hints:
        - type: role
          value: link
        - type: text_contains
          value: "Agenda"
      fallback_selector: "a[href*='calendar'], a[href*='agenda']"

  # Step 13: Wait for the calendar page to load
  - action: wait_for
    target:
      intent: "Calendar page content area with heading or calendar view"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1, .page-title, #calendarBody, .calendarView"
    timeout: "15s"

  # Step 14: Take a final screenshot as evidence of successful navigation
  - action: screenshot
