# Security and privacy

This project is local-first. The built editor and specialized report HTML files do not require a backend, login, telemetry, CDN, or runtime network access.

## Sensitive data boundary

- Never commit real financial, operating, customer, employee, vessel, route, or investor data.
- Give AI agents only redacted drafts and synthetic component data. Enter real data in the local browser after the specialized generator is built.
- Do not attach exported `.report.zip`, JSON, HTML, or PDF files containing real data to public issues.
- Report packages must use local PNG, JPEG, or WebP assets. Imported images are re-encoded to remove EXIF/GPS metadata before storage.

## Untrusted inputs

- Prefer declarative JSON report packages.
- Treat `.mjs` report packages as code. The CLI executes them only with `--trusted-code` and only from the repository `report-packages/` directory.
- The portable project importer validates archive paths, sizes, image signatures, image counts, decoded pixels, and asset completeness before replacing the current document.

## Reporting a vulnerability

Do not include sensitive reports or data in a public issue. Use GitHub's private vulnerability reporting or a private security advisory for this repository. Provide the smallest synthetic reproduction that demonstrates the problem.
