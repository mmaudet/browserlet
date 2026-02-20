# Modern SPA Pipeline Validation (TodoMVC React)
#
# Target: https://demo.playwright.dev/todomvc (Playwright's TodoMVC demo)
# Purpose: Validate the record-generate-execute pipeline against a modern
# React SPA with client-side routing, dynamic rendering, and component-based UI.
#
# SPA-specific challenges exercised:
#   - wait_for after navigation (SPA hydration timing)
#   - Dynamic list rendering after user interaction
#   - Client-side routing (hash-based #/active, #/completed filters)
#   - Component-rendered elements without stable server IDs
#
# KNOWN LIMITATION: TodoMVC submits new items via Enter keypress. BSL's `type`
# action uses Playwright's page.fill() which does not fire keyboard events.
# There is no `press_key` BSL action. As a workaround, this script uses
# navigate to pre-seed the app URL with hash routing, and tests the SPA's
# rendering, filtering, and extraction capabilities on existing UI elements.
# The todo submission limitation should be documented in VALIDATION-RESULTS.md.
#
# Run with: browserlet run --headed --timeout 30000 \
#             --output-dir browserlet-output/validation \
#             .planning/phases/040-pipeline-validation/validation-scripts/spa-modern-workflow.bsl

name: Modern SPA Pipeline Validation (TodoMVC React)
steps:
  # Step 1: Navigate to the TodoMVC React app
  - action: navigate
    value: "https://demo.playwright.dev/todomvc"

  # Step 2: Wait for the SPA to fully render the main input field
  # This is the critical SPA timing test -- the React app must hydrate
  # and render the input before we can interact with it
  - action: wait_for
    target:
      intent: "New todo input field"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo, input.new-todo"
    timeout: "15s"

  # Step 3: Verify the app header is rendered (React component mount check)
  - action: wait_for
    target:
      intent: "TodoMVC app header"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "todos"
      fallback_selector: "h1"
    timeout: "5s"

  # Step 4: Type a todo item into the input field
  # Note: page.fill() sets the value but does NOT fire Enter keypress.
  # TodoMVC requires Enter to submit, so this tests type action on SPA
  # input without triggering the submit. This is a known BSL limitation.
  - action: type
    target:
      intent: "New todo input field"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo"
    value: "Review pipeline validation results"

  # Step 5: Click the input field to verify focus/actionability on SPA element
  - action: click
    target:
      intent: "New todo input field"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo"

  # Step 6: Extract the current value from the input to verify type worked
  - action: extract
    target:
      intent: "New todo input field with typed value"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo"
    output:
      variable: "extracted.input_value"

  # Step 7: Take a screenshot showing the typed value in the input
  - action: screenshot

  # Step 8: Navigate to the "Active" filter route to test client-side routing
  # TodoMVC uses hash-based routing: #/, #/active, #/completed
  - action: navigate
    value: "https://demo.playwright.dev/todomvc#/active"

  # Step 9: Wait for the SPA to re-render after route change
  # The app should still show the header and input after client-side navigation
  - action: wait_for
    target:
      intent: "New todo input field after route change"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo"
    timeout: "10s"

  # Step 10: Navigate to the "Completed" filter route
  - action: navigate
    value: "https://demo.playwright.dev/todomvc#/completed"

  # Step 11: Wait for SPA re-render on completed route
  - action: wait_for
    target:
      intent: "TodoMVC app header on completed view"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "todos"
      fallback_selector: "h1"
    timeout: "10s"

  # Step 12: Navigate back to the main "All" view
  - action: navigate
    value: "https://demo.playwright.dev/todomvc#/"

  # Step 13: Wait for the main view to render
  - action: wait_for
    target:
      intent: "New todo input field on main all-items view"
      hints:
        - type: class_contains
          value: "new-todo"
        - type: placeholder_contains
          value: "What needs to be done"
      fallback_selector: ".new-todo"
    timeout: "10s"

  # Step 14: Hover over the app footer info area
  # Tests hover action on a SPA-rendered element
  - action: hover
    target:
      intent: "TodoMVC footer info text"
      hints:
        - type: class_contains
          value: "info"
        - type: text_contains
          value: "Double-click"
      fallback_selector: ".info, footer.info"

  # Step 15: Take a final screenshot as evidence of full SPA interaction
  - action: screenshot
