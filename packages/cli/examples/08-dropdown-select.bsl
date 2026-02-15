# 08 - Dropdown Select
#
# Demonstrates: navigate (data: URL), select action
# Hint types used: id, name
# Uses an inline HTML page with a <select> element for a self-contained demo.
# Run with: browserlet run examples/08-dropdown-select.bsl

name: Select an option from a dropdown
steps:
  # Step 1: Navigate to an inline page with a dropdown
  - action: navigate
    value: "data:text/html,<html><body><h1>Order Form</h1><label for='size'>Size:</label><select id='size' name='size'><option value='sm'>Small</option><option value='md'>Medium</option><option value='lg'>Large</option><option value='xl'>Extra Large</option></select></body></html>"

  # Step 2: Wait for the dropdown to be visible
  - action: wait_for
    target:
      intent: "Size dropdown"
      hints:
        - type: id
          value: size
      fallback_selector: "#size"
    timeout: "3s"

  # Step 3: Select the "Large" option by its value attribute
  # The select action matches the <option value="lg"> element
  - action: select
    target:
      intent: "Size dropdown"
      hints:
        - type: id
          value: size
        - type: name
          value: size
      fallback_selector: "#size"
    value: "lg"
