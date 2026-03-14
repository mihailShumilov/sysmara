# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in SysMARA, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

### Preferred Method

Use [GitHub Security Advisories](https://github.com/mihailShumilov/sysmara/security/advisories/new) to report vulnerabilities privately. This allows us to assess and address the issue before public disclosure.

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fix (if applicable)

### Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity, but we aim for patches within 14 days for critical issues

### Severity Levels

- **Critical**: Remote code execution, data exfiltration, authentication bypass
- **High**: Privilege escalation, significant data exposure
- **Medium**: Denial of service, limited data exposure
- **Low**: Information disclosure with minimal impact

## Security Considerations

SysMARA is a development framework. When deploying applications built with SysMARA, ensure:

- All environment variables containing secrets are properly secured
- Production deployments use HTTPS
- Input validation is implemented at the capability level
- Policy enforcement is properly configured for all capabilities
- Database adapters use parameterized queries

## Disclosure Policy

We follow coordinated disclosure. Once a fix is available, we will:

1. Release a patched version
2. Publish a security advisory on GitHub
3. Credit the reporter (unless they prefer anonymity)
