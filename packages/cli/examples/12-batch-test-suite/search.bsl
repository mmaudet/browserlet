# Batch Test Suite - Search Test
#
# Part of the 12-batch-test-suite/ example.
# Run all tests in this directory with:
#   browserlet test examples/12-batch-test-suite/

name: Search for a book on the catalog
steps:
  - action: navigate
    value: "https://books.toscrape.com/"

  - action: wait_for
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1"
    timeout: "10s"

  - action: extract
    target:
      intent: "First book title"
      hints:
        - type: role
          value: heading
      fallback_selector: ".product_pod h3 a"
    output:
      variable: "extracted.first_title"
