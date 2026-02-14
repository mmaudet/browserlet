name: "Simple navigation test"
steps:
  - action: navigate
    value: "https://example.com"
  - action: wait_for
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1"
    timeout: "5s"
