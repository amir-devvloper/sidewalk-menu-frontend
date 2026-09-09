# SIDE WALK — Production checklist

## 1. Backend install

```bash
cd backend
npm install
```

## 2. Secrets

Create `backend/.env` locally or, preferably, configure the same variables in the hosting provider's secret/environment settings. Never commit `.env`.

Generate the admin password hash:

```bash
npm run hash-password -- "YOUR_LONG_PASSWORD"
```

Generate a JWT signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the resulting values into the hosting provider as `ADMIN_PASSWORD_HASH` and `JWT_SECRET`.

Set `FRONTEND_ORIGINS` to the exact production origins used by the customer site and admin panel.

## 3. Supabase

The backend uses the server-side Supabase secret key. Do not expose that key to the browser.

Run `backend/database/recommended_indexes.sql` in the Supabase SQL editor after confirming the columns exist.

## 4. Admin authentication

The admin session is a short-lived JWT in an HttpOnly cookie. JavaScript no longer stores the session token in localStorage. State-changing admin requests use a CSRF token.

## 5. Payment

The project currently does not contain a live bank gateway. The order-registration flow must not be described as an online payment. When a gateway is added, create the payment on the server and verify the callback/transaction amount server-side before marking an order paid.

## 6. Local development

The site and admin panel should be served over HTTP from a local development server rather than opening HTML files with `file://`. Configure `FRONTEND_ORIGINS` accordingly.

## 7. Secret rotation

The original development repository contained sensitive environment values. Treat any previously exposed/committed credentials as compromised and rotate them before production deployment.
