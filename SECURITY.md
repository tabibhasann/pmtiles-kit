# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

Please send an email to [INSERT SECURITY EMAIL] with:

1. Description of the vulnerability
2. Steps to reproduce the issue
3. Potential impact
4. Any suggested fixes or mitigations (if you have them)

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
2. **Assessment**: We will investigate the issue and determine its severity and impact
3. **Updates**: We will keep you informed of our progress as we work to fix the issue
4. **Disclosure**: Once the issue is resolved, we will publicly disclose the vulnerability (unless you request otherwise)

### Disclosure Policy

* We will disclose vulnerabilities as soon as a fix is available
* We will credit reporters who wish to be acknowledged
* We will provide detailed information about the vulnerability and its impact
* We will provide clear instructions for users to update or mitigate the issue

## Security Best Practices

When using pmtiles-kit, please follow these security best practices:

### File Handling

* **Validate input files**: Always validate tile archives before processing them
* **Use trusted sources**: Only process tile archives from trusted sources
* **Limit file sizes**: Set reasonable limits on file sizes to prevent resource exhaustion

```python
# Example: Validate before processing
from pmtiles_kit import MBTilesArchive, ValidationError

try:
    archive = MBTilesArchive("map.mbtiles")
    archive.validate()
    # Process the archive
except ValidationError as e:
    print(f"Invalid archive: {e}")
```

### Resource Management

* **Use context managers**: Always use context managers when opening archives
* **Close resources**: Ensure all file handles and database connections are properly closed
* **Monitor memory usage**: Be aware of memory usage when processing large archives

```python
# Good: Using context manager
with MBTilesArchive("map.mbtiles") as archive:
    tile = archive.get_tile(5, 10, 15)
    # Process tile

# Resources automatically closed
```

### Network Operations

* **Use HTTPS**: When downloading tile archives, always use HTTPS
* **Verify checksums**: Verify file integrity using checksums when available
* **Set timeouts**: Set reasonable timeouts for network operations

### Dependencies

* **Keep dependencies updated**: Regularly update pmtiles-kit and its dependencies
* **Monitor security advisories**: Subscribe to security advisories for dependencies
* **Use virtual environments**: Isolate dependencies using virtual environments

## Security Features

pmtiles-kit includes several security features:

### Input Validation

* File format validation
* Tile coordinate bounds checking
* Metadata validation
* SQL injection prevention (for MBTiles)

### Resource Limits

* Configurable memory limits
* File size limits
* Operation timeouts

### Safe Defaults

* Read-only mode by default
* Explicit write operations
* No automatic execution of arbitrary code

## Vulnerability Disclosure Process

1. **Report**: Security researcher reports vulnerability
2. **Triage**: Maintainers assess severity and impact (1-3 days)
3. **Fix**: Develop and test fix (1-14 days depending on complexity)
4. **Release**: Publish security update
5. **Disclose**: Public disclosure after users have had time to update (typically 7-30 days)

## Security Updates

Security updates will be:

* Released as patch versions (e.g., 0.1.1, 0.1.2)
* Announced via GitHub Security Advisories
* Listed in the CHANGELOG.md
* Tagged with security-related labels

## Bug Bounty

Currently, we do not offer a bug bounty program. However, we greatly appreciate responsible disclosure and will acknowledge contributors in our security advisories.

## Contact

For security-related questions or concerns:

* Email: [INSERT SECURITY EMAIL]
* Security Advisories: https://github.com/[USERNAME]/pmtiles-kit/security/advisories

## Acknowledgments

We would like to thank the following individuals for responsibly disclosing security vulnerabilities:

* (Your name could be here!)
