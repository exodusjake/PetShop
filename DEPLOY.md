# Deploying Pawzora to AWS (2 EC2 + 1 RDS SQL Server)

```
 Browser ──HTTPS──► EC2 #1  "web"      nginx :80/:443   serves the React app (frontend/dist)
                       │                                forwards /api and /uploads ──┐
                       │                                                            ▼
                       └──────────────────────────────  EC2 #2  "web-api"   Node :4000 (pm2)
                                                                   │
                                                                   ▼
                                                           RDS SQL Server :1433  (private)
```

The browser only ever talks to the web server. nginx passes `/api` and `/uploads` to the API server over the private network, so the login cookie is same-site and there is no CORS to configure.

> **What was and wasn't tested.** AWS itself was not reachable from the build environment, so the AWS console steps below are written, not executed. What *was* run locally, on a brand-new empty database: `prisma migrate deploy` (all migrations), `db:bootstrap`, `admin:create`, the compiled `node dist/index.js` in production mode, and `deploy/smoke-test.sh` against it. The nginx file was checked for structure but not run, so your first command on that server should be `sudo nginx -t`.

---

## 0. Before you start

- An AWS account, a region (e.g. `ap-southeast-1`), and an EC2 **key pair** for SSH.
- The code in a Git repository you can clone from the servers (or copy it up with `scp`).
- Strongly recommended: a **domain name** (HTTPS needs one). Without a domain you can test over plain HTTP, but real customers need HTTPS.
- A way to send email (Amazon SES is easiest) so password-reset emails work. See step 6.
- Rough cost to expect: 2 small EC2 instances + 1 small RDS instance + an Elastic IP. RDS for SQL Server is the most expensive part; Express edition on `db.t3.micro` may fall inside the free tier.

## 1. Security groups (the firewall rules)

Create three security groups in the same VPC.

| Name | Inbound rules |
|------|---------------|
| `pz-web` | TCP **80** and **443** from anywhere (0.0.0.0/0). TCP **22** from **your IP only**. |
| `pz-api` | TCP **4000** from **`pz-web`** only. TCP **22** from **your IP only**. |
| `pz-rds` | TCP **1433** from **`pz-api`** only. |

The API and the database are never open to the internet. If you want to browse the database from your PC, use an SSH tunnel through the API server:
`ssh -i key.pem -L 14330:<rds-endpoint>:1433 ec2-user@<api-ip>` then connect SSMS to `localhost,14330`.

## 2. RDS (the database)

Create database → **Microsoft SQL Server**:
- Edition **Express** (fine to start; move to Standard if you outgrow its 10 GB limit), instance `db.t3.micro` or larger.
- **Public access: No**. Security group: `pz-rds`.
- Storage encryption **on**. Automated backups **7+ days**. Turn on **deletion protection**.
- Master username/password: choose a strong password and store it in a password manager.
- Copy the **endpoint** (looks like `xxxx.abc123.ap-southeast-1.rds.amazonaws.com`).

You do not create the database by hand; `prisma migrate deploy` creates `pawzora_store` for you.

## 3. Launch the two EC2 instances

Amazon Linux 2023, with an **Elastic IP** on the web server (so its address never changes). `t3.small` is comfortable; `t3.micro` works if you add swap (below) or build the frontend on your own PC. Put `pz-web` on the first and `pz-api` on the second.

Install **Node 20 or newer** on both (the project was developed on Node 24). The reliable way is nvm:

```bash
sudo dnf install -y git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && node -v
```

On a `t3.micro`, add 1 GB of swap before building:
```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=8 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

## 4. API server (EC2 #2)

```bash
sudo npm install -g pm2
git clone <your-repo-url> app && cd app/backend
npm ci
cp .env.production.example .env && chmod 600 .env && nano .env     # fill in every value (see below)
```

In `.env` set at least: `CORS_ORIGIN` and `PUBLIC_URL` (your site address), `DATABASE_URL` (the RDS endpoint and password; keep `encrypt=true`), and the `SMTP_*` / `MAIL_FROM` lines. **Do not** set `SEED_ADMIN_*`.

```bash
npx prisma migrate deploy        # creates the database and every table
npm run db:bootstrap             # roles, pet types, product categories, default settings (no demo data)

# create the first administrator (the password is typed here, never saved in a file)
read -rs ADMIN_PASSWORD; export ADMIN_PASSWORD           # type it, press Enter
ADMIN_EMAIL=you@yourdomain.com ADMIN_NAME="Your Name" npm run admin:create
unset ADMIN_PASSWORD

npm run build                    # compiles TypeScript to dist/
mkdir -p uploads
pm2 start ecosystem.config.cjs && pm2 save
pm2 startup                      # prints one command; copy/paste and run it so the API restarts after a reboot

curl http://localhost:4000/api/health                    # {"status":"ok","db":"connected"}
API_ONLY=1 bash ../deploy/smoke-test.sh http://localhost:4000
```

The server **refuses to start** (and tells you why) if the configuration is unsafe: a missing database URL, `CORS_ORIGIN=*`, or online payment methods enabled without a provider. It prints warnings for things like `http://` addresses or missing email settings, so read the first lines of `pm2 logs pawzora-api` after starting.

Admin passwords must be 12+ characters with upper-case, lower-case and a number.

## 5. Web server (EC2 #1)

```bash
sudo dnf install -y nginx git
git clone <your-repo-url> app && cd app/frontend
npm ci && npm run build          # makes dist/   (or build on your PC and scp the dist folder up)

sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/

sudo cp ../deploy/nginx-pawzora.conf /etc/nginx/conf.d/pawzora.conf
sudo sed -i 's/API_PRIVATE_IP/172.31.20.15/g' /etc/nginx/conf.d/pawzora.conf     # your API server's PRIVATE IP
```

Amazon Linux's main `/etc/nginx/nginx.conf` ships with its own default `server { … }` block. Open it (`sudo nano /etc/nginx/nginx.conf`) and delete or comment out that block so Pawzora's is the only one. Then:

```bash
sudo nginx -t                    # must say "syntax is ok"
sudo systemctl enable --now nginx
```

Open `http://<web-elastic-ip>/`. You should see the shop (empty of products until you add some). Log in at `/login` with the admin you created and open `/admin`.

## 6. Email (so password resets work)

Customers who forget their password get a reset link by email. Until email is configured, **they cannot recover their account**.

1. In **Amazon SES**, verify your domain (or a single sender address) and, for a new account, request production access to leave the sandbox.
2. Create **SMTP credentials** in the SES console.
3. Put them in `backend/.env` (`SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) and run `pm2 restart pawzora-api`.
4. Test: use "Forgot password" for your admin account and check your inbox.

Order confirmation emails use the same settings.

## 7. HTTPS (do this before real customers)

Point your domain's DNS at the web server's Elastic IP, then on the web server:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com
```

Certbot adds the HTTPS block and the HTTP-to-HTTPS redirect, and renews the certificate automatically. Afterwards add the HSTS line shown in the comments at the bottom of `nginx-pawzora.conf` to the HTTPS server block, and make sure `CORS_ORIGIN` / `PUBLIC_URL` in the API's `.env` use `https://`, then `pm2 restart pawzora-api`.

Login cookies are marked **Secure** in production, so login only works over HTTPS (or set `COOKIE_SECURE=false` for a short plain-HTTP test, then remove it).

## 8. Verify it

From your own computer:
```bash
bash deploy/smoke-test.sh https://shop.example.com
```
It checks health, the security headers, that admin/orders APIs refuse anonymous visitors, that `.env` and `.git` aren't served, and (for HTTPS) the redirect and HSTS. Every line should say PASS.

Then place a test Cash-on-Delivery order yourself and watch it appear in `/admin/orders`.

## 9. Launch checklist (decisions only you can make)

- [ ] **Settings** (`/admin/settings`): contact email/phone/address, business hours, social links, shipping fees and the free-shipping amount. The footer and contact page show only what you fill in.
- [ ] **Catalog:** add your real categories' products and photos (`/admin/products`). Update the About page text if needed.
- [ ] **Legal pages:** `/privacy` and `/terms` are written for how this site works, but they are a template. Have a lawyer review them for your business. In particular confirm the **7-day returns policy** (the site advertises "Easy Returns (7 Days)"), your shipping promises, and your registered business details.
- [ ] **Email works** (step 6) and `COOKIE_SECURE` is not set to false.
- [ ] **Payments:** Cash on Delivery only. GCash, Maya and cards need a payment provider integration with signature-verified webhooks before they can be switched on. The server will not start with them enabled.
- [ ] Test an order, a cancellation, a password reset, and an adoption application end to end.
- [ ] Remove any shared admin passwords you used while testing.

## 10. Updating the site later

API server:
```bash
cd ~/app && git pull && cd backend
npm ci && npx prisma migrate deploy && npm run build
pm2 restart pawzora-api && pm2 logs pawzora-api --lines 20
```
Web server:
```bash
cd ~/app && git pull && cd frontend
npm ci && npm run build
sudo rm -rf /usr/share/nginx/html/* && sudo cp -r dist/* /usr/share/nginx/html/
```
Take an RDS **snapshot** before any update that includes new migrations.

## 11. Backups, monitoring, upkeep

- **Database:** RDS automated backups (set in step 2). Take a manual snapshot before risky changes. Practise a restore once.
- **Uploaded images** live in `backend/uploads` on the API server's disk. They are **not** in the database backup. Snapshot the API server's EBS volume regularly, or copy the folder to S3 (`aws s3 sync backend/uploads s3://your-bucket/uploads` on a daily cron). Moving uploads to S3 permanently is a good future improvement.
- **Logs:** `pm2 logs pawzora-api` (one JSON line per request: method, path, status, time; no passwords, bodies or cookies). Install the pm2 log rotator: `pm2 install pm2-logrotate`.
- **Uptime:** point an uptime monitor at `https://shop.example.com/api/health`. Add CloudWatch alarms for EC2 status checks, RDS CPU and free storage.
- **Patching:** `sudo dnf upgrade -y` monthly and reboot in a quiet hour. Run `npm audit` in both folders occasionally.
- The login-attempt limiter keeps its counters in memory, so the API runs as **one** process (`instances: 1`). If you ever run several, move that limiter to a shared store first.

## 12. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| API won't start; log says `[config error]` | Read the message. It names the setting to fix. |
| Can log in over http but the session is lost | Normal in production: cookies are Secure. Use HTTPS (step 7). |
| `/api/...` returns 502 from nginx | API not running (`pm2 status`), wrong private IP in nginx, or `pz-api` doesn't allow port 4000 from `pz-web`. |
| `Can't reach database server` | `pz-rds` must allow 1433 from `pz-api`; check the endpoint and password in `DATABASE_URL` (braces around the password). |
| `migrate deploy` can't create the database | The master user needs permission to create databases (the RDS master user has it). |
| Images upload but don't show | `/uploads/` location missing or wrong IP in nginx. |
| Forgot-password email never arrives | SES still in sandbox, sender not verified, or `SMTP_*` wrong. Check `pm2 logs` for `[mail] could not send`. |
| Page looks unstyled / blank on a deep link | nginx `try_files $uri /index.html;` line missing from `location /`. |
