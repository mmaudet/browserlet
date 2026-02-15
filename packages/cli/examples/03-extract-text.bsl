# 03 - Extract Text Content
#
# Demonstrates: navigate, extract action with output.variable
# Hint types used: text_contains, class_contains
# The extracted value is stored in a runtime variable for later use.
# Run with: browserlet run examples/03-extract-text.bsl

name: Extract a quote from Quotes to Scrape
steps:
  # Step 1: Navigate to the quotes page
  - action: navigate
    value: "https://quotes.toscrape.com/"

  # Step 2: Extract the first quote's text
  # The 'extract' action reads text content from the matched element.
  # output.variable stores the result so subsequent steps can reference it.
  - action: extract
    target:
      intent: "First quote text on the page"
      hints:
        - type: class_contains
          value: text
      fallback_selector: ".quote .text"
    output:
      variable: "extracted.first_quote"
    timeout: "5s"
