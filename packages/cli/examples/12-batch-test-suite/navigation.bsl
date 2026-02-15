# Batch Test Suite - Navigation Test
#
# Part of the 12-batch-test-suite/ example.
# Run all tests in this directory with:
#   browserlet test examples/12-batch-test-suite/

name: Verify page navigation works
steps:
  - action: navigate
    value: "https://example.com"

  - action: wait_for
    target:
      intent: "Main heading"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "Example Domain"
      fallback_selector: "h1"
    timeout: "5s"

  - action: click
    target:
      intent: "More information link"
      hints:
        - type: role
          value: link
        - type: text_contains
          value: "More information"
      fallback_selector: "a[href*='iana']"
