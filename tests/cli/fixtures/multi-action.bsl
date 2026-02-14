name: "Multi-action test"
steps:
  - action: navigate
    value: "https://example.com"
  - action: screenshot
    value: "/tmp/browserlet-test-screenshot.png"
  - action: extract
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1"
    output:
      variable: "extracted.heading"
