# v2 performance update

- Precompress text assets at build time. Negotiate gzip with an uncompressed fallback; preserve byte ranges and HEAD requests. No API response caching changes.
- Split React into a reusable hashed vendor bundle, reducing repeat downloads when application code changes.
- Batch the five progress-report reads into one database round trip with the same queries and response structure.
- Skip background notification polling while the document is hidden; existing focus refresh remains enabled.
- No password, permission, examination, schema, or stored progress changes.

Validation: `npm run build:sites`, `node --test sites/static-assets.test.js server/org-scope.test.js`.
