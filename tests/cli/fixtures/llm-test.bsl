name: "LLM Integration Test"
steps:
  # Navigate to test page with two buttons
  - action: navigate
    value: "data:text/html,<html><body><div><button>Submit Order</button><button>Cancel</button></div></body></html>"

  # Stage 3 test: zero candidates (misspelled hint triggers hint_suggester)
  # The resolver should fail to find "Sumbit Ordr" and call LLM to suggest "Submit Order"
  - action: click
    target:
      intent: "Click submit button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Sumbit Ordr"  # Intentional typo to trigger hint_suggester
      fallback_selector: "button"
    timeout: "5s"

  # Stage 4 test: multiple candidates (two buttons, need disambiguator)
  # Only role hint provided, LLM must disambiguate between "Submit Order" and "Cancel"
  - action: click
    target:
      intent: "Click submit button again"
      hints:
        - type: role
          value: button
      # No text hint -- triggers disambiguator to pick "Submit Order" based on previous action context
      fallback_selector: "button"
    timeout: "5s"
