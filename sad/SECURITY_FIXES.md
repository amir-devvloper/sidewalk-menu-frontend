# Security & Debug Fixes

## Fixed

- Removed the hard-coded `test-token-123` flow.
- Replaced plaintext admin password comparison with scrypt password-hash verification.
- Replaced browser `localStorage` admin JWT storage with an HttpOnly session cookie.
- Added JWT issuer/audience/algorithm checks and expiration.
- Added CSRF protection for state-changing admin requests.
- Added authorization middleware to protected admin order/product/request routes.
- Added `/api/admin/me` and `/api/admin/logout`.
- Restricted CORS to exact configured origins.
- Added login, order-create, and tracking rate limits.
- Added Helmet security headers.
- Added request-body size limiting and centralized 404/error handling.
- Removed server-side error-message leakage from public API responses.
- Whitelisted product fields instead of accepting arbitrary request bodies.
- Validated product IDs, categories, prices, names, descriptions, images and quantities.
- Server now calculates order prices from the database instead of trusting browser-supplied prices.
- Server validates product existence and availability before creating an order.
- Server validates Kerman delivery bounds instead of relying only on browser-side geolocation checks.
- Public order tracking no longer returns customer phone/address/name; it returns only the tracking fields needed by the UI.
- New order codes use cryptographically secure random values; the included SQL migration adds a unique index to prevent collisions.
- Removed obsolete Mongoose models, leaked/temporary backend files and the real `.env` from the deliverable.
- Added `.env.example` and production setup documentation.
- Fixed the missing `Hero.webp` asset.
- Removed duplicate Leaflet JS loading.
- Escaped reflected customer/location values in generated HTML.
- Removed the fake-payment demo UI so the project does not misrepresent a simulated payment as a real transaction.

## Verified locally

- All JavaScript files pass `node --check` syntax validation.
- Local HTML/CSS asset references were scanned; no missing local assets remain.
- No test admin token or plaintext `ADMIN_PASSWORD` artifact remains in the deliverable.
- Admin middleware placement was statically verified for protected routes.
- Security middleware/configuration presence was verified.

## Still required before real production payment

The repository does not include a real bank-gateway integration. A real gateway requires the provider-specific merchant credentials and callback/API contract, then server-side payment initiation and callback/transaction verification. Do not mark an order as paid from a browser-only response.

## Important credential action

The original repository contained real-looking environment credentials. Rotate every previously exposed production credential before deployment, even though the secret file has been removed from this deliverable.
