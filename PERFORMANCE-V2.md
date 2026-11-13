# v2 performance update

- Restore the proven asset delivery and bundling after a blank-screen production regression. Leave compression to hosting; do not precompress Worker response bodies.
- Refresh the stylesheet URL so clients do not reuse the previous asset response.
- Batch the five progress-report reads into one database round trip with the same queries and response structure.
- Skip background notification polling while the document is hidden; existing focus refresh remains enabled.
- No password, permission, examination, schema, or stored progress changes.

Validation: `npm run build:sites`, `node --test sites/static-assets.test.js server/org-scope.test.js`.
