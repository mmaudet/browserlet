name: "Timeout test"
steps:
  - action: navigate
    value: "https://example.com"
  - action: wait_for
    target:
      intent: "Nonexistent element"
      hints:
        - type: id
          value: "does-not-exist-xyz-12345"
      fallback_selector: "#does-not-exist-xyz-12345"
    timeout: "1s"
