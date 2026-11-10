# Pawzora: what is deployed on AWS

Account `007664618923`, region **ap-southeast-1 (Singapore)**, default VPC. Everything below is **new** and tagged `Project=pawzora`. Nothing else in the account was modified.

**Live site:** https://pawzora.duckdns.org  (HTTPS, Let's Encrypt, auto-renewing)
The name comes from DuckDNS and points at the web server's Elastic IP `13.251.17.5` (set in your DuckDNS account; the IP is permanent, so it never needs updating). To use a different domain later, point it at `13.251.17.5`, then on the web server run `sudo certbot --nginx -d yourdomain.com`, change the `server_name` lines in `/etc/nginx/conf.d/pawzora.conf`, and set `CORS_ORIGIN` / `PUBLIC_URL` in the API's `.env` followed by `pm2 restart pawzora-api`. (A backup of the pre-DuckDNS nginx config is at `/etc/nginx/conf.d/pawzora.conf.bak-before-duckdns`.)
| Resource | Name / ID | Notes |
|----------|-----------|-------|
| Web server | `pawzora-web` `i-09b415c738b7d93d5` | t3.micro, Amazon Linux 2023, nginx, Elastic IP `13.251.17.5` (`eipalloc-095fec80219e2fdfd`) |
| API server | `pawzora-api` `i-04ff2c626cd6b54e8` | t3.small, Node 22, pm2. Public IP `54.254.157.217`, private `172.31.33.78` |
| Database | `pawzora-db` | RDS SQL Server 2019 **Express**, db.t3.micro, 20 GB, encrypted, not public, 7-day backups. Endpoint `pawzora-db.ctaisw4g4o2g.ap-southeast-1.rds.amazonaws.com` |
| Security groups | `pawzora-web` `sg-01a397061d873d854`, `pawzora-api` `sg-0668f76e55c4bfc24`, `pawzora-rds` `sg-08c61b1e07feff810` | web: 80/443 open, 22 from your PC only. api: 4000 from web only, 22 from your PC only. rds: 1433 from api only |
| SSH key | `pawzora-key` | private half: `C:\Users\Jake\.ssh\pawzora-key.pem` (login user `ec2-user`) |

Passwords (database master and website admin) are in `C:\Users\Jake\.pawzora\deployment-secrets.txt`, outside the project. SSH is allowed only from the PC's public IP at the time of deployment (`49.144.0.35`); if your IP changes, add the new one to the `pawzora-web` and `pawzora-api` security groups.

Site admin login: `astramentoring.iot@gmail.com` (password in the secrets file).

## Day-to-day

```bash
# SSH in
ssh -i ~/.ssh/pawzora-key.pem ec2-user@13.251.17.5       # web
ssh -i ~/.ssh/pawzora-key.pem ec2-user@54.254.157.217    # api

# API logs / restart (on the api server)
pm2 logs pawzora-api --lines 50
pm2 restart pawzora-api

# health
curl https://pawzora.duckdns.org/api/health
bash deploy/smoke-test.sh https://pawzora.duckdns.org
```

To release a new version, follow "Updating the site later" in `DEPLOY.md` (build the frontend, copy `dist/` to `/usr/share/nginx/html/` on the web server; on the API server unpack the backend, `npm ci`, `npx prisma migrate deploy`, `npm run build`, `pm2 restart pawzora-api`).

## Known gaps on this deployment

- **Email is not configured**, so password-reset and order-confirmation emails are not sent. Add the `SMTP_*` / `MAIL_FROM` settings (Amazon SES works) to `~/app/backend/.env` on the API server, then `pm2 restart pawzora-api`.
- Cash on Delivery is the only payment method.
- The 24 products, 4 adoptable pets and 3 blog articles are **sample data** (marked "demo" on the site). Replace them from the admin area.
- Uploaded images are stored on the API server's disk; snapshot its volume or copy `~/app/backend/uploads` to S3 regularly.
- The database has **deletion protection off**. Turn it on before real customers arrive.

## Removing everything Pawzora created (and only that)

These commands name explicit IDs, so they cannot touch the other project in the account. Run them in this order.

```bash
R=ap-southeast-1
aws ec2 terminate-instances --region $R --instance-ids i-09b415c738b7d93d5 i-04ff2c626cd6b54e8
aws rds delete-db-instance --region $R --db-instance-identifier pawzora-db --skip-final-snapshot --delete-automated-backups
aws ec2 wait instance-terminated --region $R --instance-ids i-09b415c738b7d93d5 i-04ff2c626cd6b54e8
aws ec2 release-address --region $R --allocation-id eipalloc-095fec80219e2fdfd
aws rds wait db-instance-deleted --region $R --db-instance-identifier pawzora-db
aws ec2 delete-security-group --region $R --group-id sg-08c61b1e07feff810     # pawzora-rds
aws ec2 delete-security-group --region $R --group-id sg-0668f76e55c4bfc24     # pawzora-api
aws ec2 delete-security-group --region $R --group-id sg-01a397061d873d854     # pawzora-web
aws ec2 delete-key-pair --region $R --key-name pawzora-key
```
Deleting the database erases the site's data permanently. Take a snapshot first (drop `--skip-final-snapshot` and add `--final-db-snapshot-identifier pawzora-final`) if you want to keep it.
