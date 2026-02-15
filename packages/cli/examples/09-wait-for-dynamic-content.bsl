# 09 - Wait for Dynamic Content
#
# Demonstrates: wait_for action with custom timeout override
# Hint types used: id, text_contains
# Uses a data: URL with JavaScript that delays element rendering by 2 seconds,
# proving that wait_for properly waits for dynamically inserted content.
# Run with: browserlet run examples/09-wait-for-dynamic-content.bsl

name: Wait for dynamically loaded content
steps:
  # Step 1: Navigate to a page that delays content by 2 seconds
  - action: navigate
    value: "data:text/html,<html><body><h1>Loading...</h1><div id='container'></div><script>setTimeout(function(){document.getElementById('container').innerHTML='<p id=\"loaded\">Content loaded successfully!</p>';document.querySelector('h1').textContent='Done!';},2000);</script></body></html>"

  # Step 2: Wait for the dynamically inserted element
  # The timeout is set to 10s to give plenty of room for the 2s delay.
  # Without a sufficient timeout, this step would fail.
  - action: wait_for
    target:
      intent: "Dynamically loaded content paragraph"
      hints:
        - type: id
          value: loaded
        - type: text_contains
          value: "Content loaded successfully"
      fallback_selector: "#loaded"
    timeout: "10s"
