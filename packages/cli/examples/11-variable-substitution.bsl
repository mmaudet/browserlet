# 11 - Variable Substitution
#
# Demonstrates: extract + variable substitution flow
# Hint types used: id, name
# Shows how to extract a value into a variable with output.variable,
# then use {{extracted.varname}} in a later step's value field.
# Run with: browserlet run examples/11-variable-substitution.bsl

name: Extract a value and substitute it in a later step
steps:
  # Step 1: Navigate to a page with a pre-filled value
  - action: navigate
    value: "data:text/html,<html><body><h1>Variable Demo</h1><p id='source'>REF-2025-0042</p><form><input id='ref-input' name='reference' type='text' placeholder='Enter reference'/><button type='submit'>Submit</button></form></body></html>"

  # Step 2: Extract the reference number from the paragraph
  # The extracted value is stored in extracted.ref_number
  - action: extract
    target:
      intent: "Source reference number"
      hints:
        - type: id
          value: source
      fallback_selector: "#source"
    output:
      variable: "extracted.ref_number"

  # Step 3: Type the extracted value into the input field
  # {{extracted.ref_number}} is substituted at runtime with the value
  # extracted in step 2 (e.g., "REF-2025-0042")
  - action: type
    target:
      intent: "Reference input field"
      hints:
        - type: id
          value: ref-input
        - type: name
          value: reference
      fallback_selector: "#ref-input"
    value: "{{extracted.ref_number}}"
