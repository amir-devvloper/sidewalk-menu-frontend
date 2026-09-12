# Aban Gateway Fix - SideWalk

## What was fixed

- Corrected Aban API base to `https://api.abangateway.ir/api/v1` with env override support.
- Removed the accidentally embedded live token from the project tree.
- Added secure server-only env configuration for API token and webhook secret.
- Added request timeout, structured Aban error codes, Retry-After support and safer logs.
- Added resilient extraction/validation of `invoice_id` and `payment_url`.
- Added the missing Supabase payment migration.
- Replaced the production payment callback with a signed POST webhook flow.
- Added HMAC-SHA256 webhook signature verification.
- Added server-side invoice verify plus order/invoice/amount matching before marking paid.
- Fixed `already_verified`: only that specific 409 is accepted, not every 409 response.
- Kept the old GET callback only as a manual/backward-compatible diagnostic route.
- Exempted the signed Aban webhook from the customer tracking rate limiter.
- Added frontend payment URL fallbacks for compatible backend response shapes.

## Required deployment steps

1. Run `backend/database/migration_aban_gateway.sql` in Supabase SQL Editor.
2. Add the variables listed in `ABAN_GATEWAY_SETUP.md` to Render Environment Variables.
3. Redeploy the backend.

Do not commit a real `.env` file or payment secret to Git.
