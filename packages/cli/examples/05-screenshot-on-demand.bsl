# 05 - Screenshot on Demand
#
# Demonstrates: navigate, screenshot action
# The screenshot action captures the current page state to a file.
# The value field specifies the output file path.
# Run with: browserlet run examples/05-screenshot-on-demand.bsl

name: Take a screenshot of example.com
steps:
  # Step 1: Navigate to the target page
  - action: navigate
    value: "https://example.com"

  # Step 2: Wait briefly for page to fully render
  - action: wait_for
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1"
    timeout: "5s"

  # Step 3: Take a screenshot
  # The value specifies the file path for the screenshot image.
  # If omitted, a timestamped filename is generated automatically.
  - action: screenshot
    value: "browserlet-output/example-com-screenshot.png"
