# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v2.x    | :white_check_mark: |
| v1.x    | :x:                |
| v0.x    | :x: (development)  |

## Reporting a Vulnerability

If you discover a security vulnerability in this action, please report it
responsibly. **Do not open a public issue.**

Email **security@garnet.ai** with:

- A description of the vulnerability
- Steps to reproduce
- Any relevant logs or screenshots (redact secrets)

We will acknowledge your report within 2 business days and aim to provide a
fix or mitigation within 7 business days for critical issues.

## Security Considerations

This action runs with elevated privileges (`sudo`) on the GitHub Actions
runner to install and manage the Jibril runtime security service. Key security
properties:

- **HTTPS-only downloads**: All binary downloads enforce HTTPS.
- **Secret redaction**: API tokens and agent tokens are registered with
  `core.setSecret()` so they are masked in logs.
- **Credential cleanup**: The `/etc/default/jibril` environment file
  (which contains tokens during the run) is deleted in the post step.
- **Minimal permissions**: The action requires only `contents: read` by
  default. PR comment functionality requires `pull-requests: write`.
