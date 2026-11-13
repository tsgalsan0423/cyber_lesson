# Password recovery via the government Zimbra mailbox

The login dialog requests a six-digit code, then accepts that code with a new password. The code goes only to the existing account's stored email. The API never accepts a destination override. No automatic login follows a reset.

## Runtime configuration

Set these server-only runtime values in Sites (or the local process environment). For local `.env` loading use `node --env-file=.env server/index.js`. Never commit a mailbox password or put it in a VITE variable.

- `JWT_SECRET`: existing signing secret, at least 32 bytes. Keep the existing production value.
- `MAIL_USERNAME`: `galsan.ts@khurdan.gov.mn`.
- `MAIL_FROM`: the same address, or an alias the mailbox is authorized to send as.
- `MAIL_SOAP_URL`: `https://mail.gov.mn/service/soap`.
- `MAIL_PASSWORD`: secret mailbox credential. For two-factor accounts use an approved application credential if supported by the provider.
- `PASSWORD_RECOVERY_ENABLED`: set `true` after configuring and testing delivery. Default is off.

The government service is Zimbra. This integration uses account AuthRequest and SendMsgRequest over HTTPS, with TLS validation, no redirects, a 15-second total timeout, and no mail-server error-body logging. It does not need the Zimbra administrator account or mail forwarding.

For Worker compatibility use `redirect: 'manual'`, then reject non-2xx responses. Cloudflare Workers rejects `redirect: 'error'` when constructing the request, before contacting the mailbox; a successful Node-only delivery test does not cover this runtime difference. Never use automatic redirect following for requests containing mailbox credentials or authentication cookies. Reference: https://developers.cloudflare.com/workers/runtime-apis/request/

The SOAP endpoint/account policy and actual delivery must be confirmed against mail.gov.mn with a configured sender. An HTTP success from this application or a mocked transport test does not verify external delivery. If the provider disallows SOAP account sending, obtain its approved API/relay settings from the National Data Center; do not substitute a third-party sender silently.

## Data and verification

Recovery tables are created lazily on the first enabled recovery request, independently from existing lesson migrations. Codes are HMAC protected, expire after ten minutes, allow five guesses, and are rate limited. Successful recovery changes only the password hash, clears the initial-password flag, and increments the session version to invalidate existing sessions and recovery challenges. Courses and progress are untouched.

Run `node --test server/password-recovery.test.js server/recovery-mail.test.js server/org-scope.test.js sites/static-assets.test.js` after `npm run build:sites`.

Before enabling production, send a real code to an approved test account, verify expiry and password reset, confirm the old password and sessions fail, and confirm the normal login and admin login pages still render.

References:
- https://guide.datacenter.gov.mn/books/toriin-caxim-suudangiin-sistem/page/6-meil-forwarding
- https://github.com/Zimbra/zm-mailbox/blob/develop/store/docs/soap.txt
