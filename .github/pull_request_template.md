## What changed

<!-- Explain user impact and why this is the smallest safe change. -->

## Security / privacy impact

- [ ] No message plaintext can reach a server route, log, DB, analytics tool, or error payload.
- [ ] No private key or passphrase can leave the device in raw form.
- [ ] No new remote script, tracker, or public object-storage URL.
- [ ] If protocol code changed: compatibility note + conformance checks added.

## Validation

- [ ] `next typegen`
- [ ] `tsc --noEmit`
- [ ] lint
- [ ] production build
- [ ] conformance `allOk:true`
- [ ] affected deployment dry-run / preview
- [ ] docs and CHANGELOG updated

## Rollback

<!-- Name the last-good tag and whether the schema change is additive. -->
