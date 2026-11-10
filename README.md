# Pawzora – Pet Shop E-Commerce

React + TypeScript + Tailwind (frontend) · Node + Express + Prisma (backend) · **SQL Server** (database).
Currency: Philippine Peso (₱). All seeded products, reviews, orders and pets are **demo data**.

> Stack note: the original brief asked for PostgreSQL. This project uses SQL Server (what you run locally and on RDS).
> Prisma supports it; SQL Server has no native enums, so status fields are validated strings.

## Build status
| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Setup, design system, 29-model database, migrations, seed | ✅ done |
| 2 | Homepage, navbar/footer, shop (search/filter/sort/pagination), product pages | ✅ done |
| 3 | Register / login / sessions / roles / password reset / account settings / server wishlist | ✅ done |
| 4 | Cart, checkout, orders, inventory | ✅ done |
| 5 | Customer + admin dashboards | ✅ done |
| 6 | Adoption, blog, reviews, promotions, contact | ✅ done |
| 7 | Security review, responsive pass, deployment prep, legal pages, email | ✅ done |

The cart lives on the server (guest cookie, merged into the account at login). The wishlist is saved to your account when logged in; a guest wishlist is merged in at login. Routes for later phases exist and show a "coming in Phase N" page.

## Run locally
Requires Node 20+ and a SQL Server with SQL login (`sa`) enabled and TCP 1433.

```powershell
cd backend
npm install
copy .env.example .env        # edit DATABASE_URL password
npx prisma migrate deploy     # or: npm run db:migrate  (creates database pawzora_store)
npm run db:seed               # 24 products, categories, adoption pets, blog, demo accounts
npm run dev                   # API on http://localhost:4000

cd ../frontend
npm install
npm run dev                   # site on http://localhost:5173 (proxies /api to :4000)
```

Demo accounts (dev only): `customer@pawzora.demo` / `Customer#12345`, admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Auth notes
- Passwords: bcrypt (cost 12). Sessions: random 256-bit token in an HttpOnly, SameSite=Lax cookie; only a SHA-256 hash is stored.
- New accounts are always CUSTOMER. Admin is created only by the dev seed (never in production). Roles are enforced by the API.
- CSRF: every state-changing request needs the `X-Requested-With: pawzora` header and a same-site Origin.
- Login/register/reset endpoints are rate-limited. Password reset emails are not configured yet: in development the reset link is printed in the API console and shown on the page; in production no link is returned.
- Google/Apple sign-in is intentionally not shown until OAuth credentials are configured.

## Dashboards
- **Customer** (`/account`): live stats, orders (track + cancel), wishlist, pets with photos, saved addresses (the default one prefills checkout), settings.
- **Admin** (`/admin`, ADMIN role only, separate layout, lazy-loaded): dashboard with charts, products (create/edit/archive/restore, sale prices, image upload), categories & pet types, inventory (quick stock edits), orders (status flow, courier + tracking, COD payment record, refund record), payments ledger, customers (suspend/reactivate), reports (sales, orders, products, inventory, customers) with date filters and CSV export, store settings (contact info, social links, shipping fees). Adoption, Blog, Reviews, Promotions and Messages are fully built (the sidebar shows live badges for pending applications and unread messages).
- Every admin change is written to the audit log. Admin pages are hidden from customers in the UI, **and** every `/api/admin` route enforces the role on the server.
- Uploads: JPEG/PNG/WebP up to 5 MB; the file type is detected from the file contents (never the name or the browser's claim), SVG is refused, and files get random names. They are stored in `backend/uploads` (move to S3 for production).

## Adoption, blog, reviews, promotions, contact
- **Adoption:** public list with filters and pet pages. Applying needs an account; every application starts as PENDING and **only an admin can approve or reject** (a decision is final and can carry a note the applicant sees). Approving does not change the pet's status; the admin does that in the Pets tab. Pets that have applications can't be deleted. Max 5 open applications per person.
- **Blog:** drafts are private until published; a published article keeps its address when retitled. Content is plain text (blank line = paragraph, `## ` = heading) and is never rendered as HTML.
- **Reviews:** only customers with a **delivered** order of the product can review it, once. Authors are shown as "First L.". Admins can hide, republish or delete reviews and the product rating updates automatically.
- **Promotions:** discount codes (percent or fixed, minimum spend, start/expiry, usage limit, enable/disable). Used codes can't be deleted, only disabled.
- **Contact:** messages are stored and shown in the admin inbox. The form has a hidden spam-trap field and a per-IP rate limit. Contact details on the page and footer come from Admin → Settings.

## Shopping notes
- The browser sends only product ids and quantities. Prices, discounts, shipping and totals are always recalculated by the API.
- Checkout requires an account. Only Cash on Delivery is live; GCash, Maya and cards show as "coming soon" until a payment provider is integrated. COD orders stay Unpaid until an admin records payment (Phase 5).
- Stock is reserved atomically when the order is placed (two shoppers cannot buy the last unit) and returned when an unpaid order is cancelled.
- Shipping fees and the free-shipping threshold come from Store Settings in the database (defaults: ₱99 standard, ₱199 express, free standard over ₱2,000).
- Demo codes: PAWZORA10 (10% off, min ₱500), SAVE100 (₱100 off, min ₱1,500).

## Tests
`cd backend && npm test` runs 74 API tests (auth, roles, CSRF, wishlist scoping, password reset, cart pricing and tamper-proofing, stock limits, coupons, the last-unit race, order privacy, cancel and restock, admin access control on every route, upload safety, order status flow, payment rules, CSV formula-injection, suspending accounts, settings validation, address/pet privacy, adoption rules and approval flow, blog drafts, verified-purchase reviews, coupon validation, contact spam-trap and inbox, login throttling, production config check, email delivery, admin-creation tool). `cd frontend && npm test` runs the redirect-safety tests against the dev database using throwaway `@pawzora.test` accounts.

## Security (reviewed in Phase 7)
- Dependencies audited. Patched react-router and nodemailer; the remaining `zod` advisory (memory use on huge arrays) is neutralised by a 100 KB request limit.
- The `?next=` login redirect only accepts same-site paths (blocks `//host`, `/\host`, encoded tricks). Per-account login throttling, session rotation on login, `no-store` API caching, clean 400/413 for bad requests.
- The API refuses to start in production with an unsafe config (no `*` CORS, no unsupported online payments, database URL required) and warns about http, localhost, missing email, leftover example passwords.
- There is no way to become an admin through the website: use `npm run admin:create` on the server.

## Accessibility and responsive design
Every page (public, customer, admin) was checked at phone, tablet and desktop widths: no sideways scrolling, no console errors. Keyboard access, landmarks, headings, labels and reduced-motion are covered. **Known item:** white text on the brand orange (#E86A16) measures 3.2:1, below the 4.5:1 guideline for small text. Buttons keep the specified brand colour; small orange *text links* use a deeper orange (`text-link`). To make buttons AA-compliant too, darken `primary` in `frontend/tailwind.config.js` to about `#BF5410`.

## Not built yet (known gaps)
- Online payments (GCash, Maya, cards) and Google/Apple sign-in: need provider accounts and credentials.
- Product *variants* are supported in the shop and cart but there is no admin screen to create them yet.
- Customer-initiated refund requests (admins can record refunds), and in-app notifications.
- Uploaded images are stored on the API server's disk (move to S3 for resilience).

## Deploying
See **DEPLOY.md** (AWS: 2 EC2 + RDS), `deploy/nginx-pawzora.conf`, `deploy/smoke-test.sh`, `backend/ecosystem.config.cjs` and `backend/.env.production.example`.

## Useful commands
- `npm run db:reset` (backend) wipes and re-seeds the dev database
- `npm run db:bootstrap` (backend) base categories/settings for a new database (safe to repeat)
- `npm run admin:create` (backend) creates an administrator; see DEPLOY.md
- `npm run build && npm start` (backend) compiled production server
- `npx prisma studio` browses data in the browser
- `npm run typecheck` in either folder

## Layout
```
backend/  prisma/schema.prisma, prisma/seed.ts, src/{app,index}.ts, src/routes/, src/lib/
frontend/ src/{pages,components,context,lib}, public/img (photos + logo)
```
