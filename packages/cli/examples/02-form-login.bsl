# 02 - Form Interaction
#
# Demonstrates: navigate, type, click actions
# Hint types used: name, placeholder_contains, text_contains, role
# Run with: browserlet run examples/02-form-login.bsl

name: Fill and submit a form on httpbin.org
steps:
  # Step 1: Navigate to the form page
  - action: navigate
    value: "https://httpbin.org/forms/post"

  # Step 2: Type into the "Customer name" field
  # Uses 'name' hint to match the input's name attribute
  - action: type
    target:
      intent: "Customer name input field"
      hints:
        - type: name
          value: custname
      fallback_selector: "input[name='custname']"
    value: "Jane Doe"

  # Step 3: Type into the telephone field
  - action: type
    target:
      intent: "Telephone number input field"
      hints:
        - type: name
          value: custtel
        - type: type
          value: tel
      fallback_selector: "input[name='custtel']"
    value: "+33 1 23 45 67 89"

  # Step 4: Type into the email field
  - action: type
    target:
      intent: "Email address input field"
      hints:
        - type: name
          value: custemail
        - type: type
          value: email
      fallback_selector: "input[name='custemail']"
    value: "jane@example.com"

  # Step 5: Click the submit button
  - action: click
    target:
      intent: "Submit button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Submit"
      fallback_selector: "button[type='submit']"
