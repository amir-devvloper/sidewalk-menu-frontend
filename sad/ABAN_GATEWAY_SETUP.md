# SideWalk + Aban Gateway

## Render Environment Variables

Add these variables to the **backend** service on Render:

- `ABAN_API_TOKEN` = your Aban Gateway API token (server-side only)
- `ABAN_CALLBACK_URL` = `https://sidewalk-menu-backend.onrender.com/api/orders/payment/callback`

`BACKEND_PUBLIC_URL` is not required by the current code.

## Supabase

The payment columns are included in:
`backend/database/migration_new_features.sql`

If you already ran the SQL that added these four columns, do not run anything else.

## Payment flow

1. Customer submits an order.
2. Backend resolves product prices from Supabase.
3. Backend creates an Aban invoice in rial (`toman × 10`).
4. Invoice ID and payment URL are saved in `orders`.
5. Customer is redirected to Aban.
6. Aban returns the browser to the backend callback.
7. Backend calls Aban's server-side `verify` endpoint.
8. Only after verification, `payment_status` becomes `paid`.
9. Customer is redirected back to the SideWalk frontend.

The Aban token is never placed in `script.js` or any frontend file.

## Important

Do not put a real API token in `.env` inside the ZIP or commit it to Git.
Use Render Environment Variables for production.
