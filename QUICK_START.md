# 🚀 Quick Start Guide

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (if not running)
brew services start postgresql@16  # macOS
# OR
sudo systemctl start postgresql    # Linux

# 3. Create database
createdb autoapply

# 4. Test connection
npm run db:check

# 5. Run migrations
npm run db:migrate-all

# 6. Start server
npm run dev
```

## Railway Deployment

```bash
# 1. Test on Railway
railway run npm run db:check

# 2. Run migrations (if needed)
railway run npm run db:migrate-all

# 3. Deploy
git add .
git commit -m "your message"
git push

# 4. Check logs
railway logs
```

## Useful Commands

```bash
npm run db:check          # Test database connection
npm run db:migrate-all    # Run all migrations
npm run db:diagnose       # Diagnose and fix issues
npm run dev               # Start development server
npm start                 # Start production server
```

## Expected Environment

| Environment | NODE_ENV | Database Host | SSL |
|------------|----------|---------------|-----|
| Local | `development` | `localhost` | No |
| Railway | `production` | `postgres.railway.internal` | Yes |

## Troubleshooting

**ENOTFOUND error?**
```bash
# Check your environment
echo $NODE_ENV

# Should be "development" locally, "production" on Railway
```

**Connection refused?**
```bash
# PostgreSQL not running
brew services start postgresql@16
```

**Tables missing?**
```bash
npm run db:migrate-all
```

## Documentation

- 📘 Full Guide: [`DATABASE_CONNECTION_GUIDE.md`](DATABASE_CONNECTION_GUIDE.md)
- 🚀 Deployment: [`DEPLOYMENT_SUMMARY.md`](DEPLOYMENT_SUMMARY.md)
- 🔧 Database Fix: [`DATABASE_FIX_INSTRUCTIONS.md`](DATABASE_FIX_INSTRUCTIONS.md)
