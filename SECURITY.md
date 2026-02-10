# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Knot, **please do not open a public issue.**

### How to Report

- **GitHub**: Use [Private Vulnerability Reporting](https://github.com/pher-lab/knot/security/advisories/new)
- **Email**: [knot.wackiness531@passinbox.com](mailto:knot.wackiness531@passinbox.com)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Credit in the fix (unless you prefer anonymity)

## Scope

The following are in scope for security reports:

- Cryptographic implementation issues (`src-tauri/src/crypto/`)
- Data leakage (plaintext on disk, logs, etc.)
- Authentication bypass
- Key management flaws

## Known Limitations

This software is in **closed alpha** and has **not undergone a formal security audit**. Known trade-offs are documented in [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md).

## Security Design

See [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) and [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) for the full security architecture.
