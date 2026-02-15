# 10 - Hover and Scroll
#
# Demonstrates: hover and scroll actions
# Hint types used: role, text_contains, id
# Uses a data: URL with elements positioned to require scrolling.
# Run with: browserlet run examples/10-hover-and-scroll.bsl

name: Hover over and scroll to elements
steps:
  # Step 1: Navigate to a page with content that requires scrolling
  - action: navigate
    value: "data:text/html,<html><body><h1 id='top'>Hover and Scroll Demo</h1><p id='intro'>Hover over the heading above, then scroll down.</p><div style='height:1500px;background:linear-gradient(white,lightblue);'></div><p id='bottom'>You scrolled to the bottom!</p></body></html>"

  # Step 2: Hover over the heading
  # The hover action moves the mouse pointer over the element.
  # Playwright handles scrolling the element into view automatically.
  - action: hover
    target:
      intent: "Top heading"
      hints:
        - type: id
          value: top
        - type: role
          value: heading
      fallback_selector: "#top"

  # Step 3: Scroll to the bottom paragraph
  # The scroll action uses scrollIntoViewIfNeeded to bring the element
  # into the viewport without needing to specify pixel offsets.
  - action: scroll
    target:
      intent: "Bottom paragraph"
      hints:
        - type: id
          value: bottom
        - type: text_contains
          value: "scrolled to the bottom"
      fallback_selector: "#bottom"

  # Step 4: Verify the bottom element is now visible
  - action: wait_for
    target:
      intent: "Bottom paragraph after scroll"
      hints:
        - type: id
          value: bottom
      fallback_selector: "#bottom"
    timeout: "3s"
