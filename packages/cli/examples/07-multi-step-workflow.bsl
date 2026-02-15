# 07 - Multi-Step Workflow
#
# Demonstrates: chaining multiple actions across page navigations
# Hint types used: text_contains, role, class_contains
# Shows a real workflow: navigate, click through to a detail page, extract data.
# Run with: browserlet run examples/07-multi-step-workflow.bsl

name: Browse books and extract a title
steps:
  # Step 1: Navigate to the books catalog
  - action: navigate
    value: "https://books.toscrape.com/"

  # Step 2: Wait for the catalog to load
  - action: wait_for
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "All products"
      fallback_selector: "h1"
    timeout: "10s"

  # Step 3: Click on a category link in the sidebar
  - action: click
    target:
      intent: "Travel category link in the sidebar"
      hints:
        - type: role
          value: link
        - type: text_contains
          value: "Travel"
      fallback_selector: "a[href*='travel']"

  # Step 4: Wait for the category page to load
  - action: wait_for
    target:
      intent: "Category page heading"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "Travel"
      fallback_selector: ".page-header h1"
    timeout: "10s"

  # Step 5: Extract the first book title from the category page
  - action: extract
    target:
      intent: "First book title in the listing"
      hints:
        - type: role
          value: heading
      fallback_selector: ".product_pod h3 a"
    output:
      variable: "extracted.book_title"
