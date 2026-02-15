# 01 - Navigate and Verify
#
# Demonstrates: navigate, wait_for actions
# Hint types used: role, text_contains
# Run with: browserlet run examples/01-navigate-and-verify.bsl

name: Navigate to Example.com and verify heading
steps:
  # Step 1: Navigate to the target URL
  - action: navigate
    value: "https://example.com"

  # Step 2: Wait for the main heading to appear
  # Uses semantic hints: role=heading ensures we find an <h1>/<h2>/etc,
  # text_contains narrows to the specific heading text
  - action: wait_for
    target:
      intent: "Main heading on the page"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "Example Domain"
      fallback_selector: "h1"
    timeout: "5s"
