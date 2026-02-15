# 04 - Table Extraction
#
# Demonstrates: navigate (with data: URL), table_extract action
# The table_extract action returns structured data: { headers, rows }
# Uses an inline HTML table via data: URL for a self-contained demo.
# Run with: browserlet run examples/04-table-extract.bsl

name: Extract data from an HTML table
steps:
  # Step 1: Navigate to an inline page with a table
  - action: navigate
    value: "data:text/html,<html><body><table id='products'><thead><tr><th>Product</th><th>Price</th><th>Stock</th></tr></thead><tbody><tr><td>Widget A</td><td>$12.99</td><td>150</td></tr><tr><td>Widget B</td><td>$24.50</td><td>87</td></tr><tr><td>Widget C</td><td>$8.00</td><td>342</td></tr></tbody></table></body></html>"

  # Step 2: Extract the table into structured data
  # Returns: { headers: ["Product","Price","Stock"], rows: [{...}, ...] }
  - action: table_extract
    target:
      intent: "Products data table"
      hints:
        - type: id
          value: products
      fallback_selector: "#products"
    output:
      variable: "extracted.products_table"
    timeout: "5s"
