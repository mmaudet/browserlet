# Batch Test Suite - Login Test
#
# Part of the 12-batch-test-suite/ example.
# Run all tests in this directory with:
#   browserlet test examples/12-batch-test-suite/
#
# Options:
#   --bail          Stop on first failure
#   --workers 3     Run tests in parallel
#
# Each script is run in a fresh, isolated browser instance.

name: Verify login form is accessible
steps:
  - action: navigate
    value: "https://httpbin.org/forms/post"

  - action: wait_for
    target:
      intent: "Customer name input field"
      hints:
        - type: name
          value: custname
      fallback_selector: "input[name='custname']"
    timeout: "10s"

  - action: type
    target:
      intent: "Customer name input field"
      hints:
        - type: name
          value: custname
      fallback_selector: "input[name='custname']"
    value: "Test User"
