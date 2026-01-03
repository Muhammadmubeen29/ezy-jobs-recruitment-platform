# Vercel Deployment Checklist

## Pre-Deployment

- [ ] All code is committed and pushed to repository
- [ ] MongoDB Atlas database is set up and accessible
- [ ] MongoDB IP whitelist allows all IPs (`0.0.0.0/0`) or Vercel IPs
- [ ] Stripe account is configured (test or live keys)
- [ ] Gmail app password is generated for email service
- [ ] Environment variables are documented and ready

## Backend Deployment (`server/`)

### Vercel Project Configuration
- [ ] Create new Vercel project
- [ ] Set Root Directory: `server`
- [ ] Framework Preset: Other
- [ ] Build Command: (empty)
- [ ] Output Directory: (empty)
- [ ] Install Command: `npm install`

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` (MongoDB Atlas connection string)
- [ ] `JWT_ACCESS_TOKEN_SECRET` (min 32 characters)
- [ ] `JWT_REFRESH_TOKEN_SECRET` (min 32 characters)
- [ ] `JWT_ACCESS_TOKEN_EXPIRES_IN=15m`
- [ ] `JWT_REFRESH_TOKEN_EXPIRES_IN=30d`
- [ ] `SERVER_URL` (will be set after deployment - use Vercel URL)
- [ ] `CLIENT_URL` (will be set after frontend deployment)
- [ ] `CORS_ORIGIN` (comma-separated frontend URLs)
- [ ] `NODEMAILER_SMTP_USER` (Gmail address)
- [ ] `NODEMAILER_SMTP_PASS` (Gmail app password)
- [ ] `NODEMAILER_SMTP_EMAIL` (from email address)
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `AI_SERVER_URL` (ML service URL if deployed separately)

### Post-Deployment
- [ ] Copy backend Vercel URL (e.g., `https://your-backend.vercel.app`)
- [ ] Test health endpoint: `https://your-backend.vercel.app/api/v1/test`
- [ ] Verify database connection works
- [ ] Update `SERVER_URL` environment variable with actual URL

## Frontend Deployment (`client/`)

### Vercel Project Configuration
- [ ] Create new Vercel project
- [ ] Set Root Directory: `client`
- [ ] Framework Preset: Vite
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `dist` (default)
- [ ] Install Command: `npm install` (default)

### Environment Variables
- [ ] `VITE_SERVER_URL` (backend Vercel URL from above)
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` (same as backend)
- [ ] `VITE_GA_TRACKING_ID` (Google Analytics ID, if used)

### Post-Deployment
- [ ] Copy frontend Vercel URL (e.g., `https://your-frontend.vercel.app`)
- [ ] Update backend `CLIENT_URL` environment variable
- [ ] Update backend `CORS_ORIGIN` environment variable
- [ ] Redeploy backend to apply CORS changes
- [ ] Test frontend loads correctly
- [ ] Test API calls from frontend work

## Verification Tests

### Authentication
- [ ] User registration works
- [ ] Email verification works
- [ ] User login works
- [ ] JWT tokens are issued correctly
- [ ] Protected routes require authentication

### Core Features
- [ ] Job posting works
- [ ] Job applications work
- [ ] Resume upload works
- [ ] AI shortlisting works (if ML service is deployed)
- [ ] Payment processing works (Stripe)
- [ ] Email notifications work

### API Endpoints
- [ ] `/api/v1/test` returns success
- [ ] `/api/v1/auth/*` endpoints work
- [ ] `/api/v1/jobs/*` endpoints work
- [ ] `/api/v1/applications/*` endpoints work
- [ ] All other API routes respond correctly

### Frontend Routes
- [ ] Homepage loads
- [ ] All pages are accessible
- [ ] Client-side routing works (no 404s on refresh)
- [ ] Protected routes redirect to login

## Known Limitations

⚠️ **Socket.io & WebRTC**: These features will NOT work in Vercel serverless functions. Consider:
- Deploying backend to Railway/Render/Fly.io for WebSocket support
- Using a separate WebSocket service
- Disabling real-time features in production

## Troubleshooting

### CORS Errors
1. Check `CORS_ORIGIN` includes frontend URL (no trailing slash)
2. Verify `CLIENT_URL` matches frontend URL
3. Check browser console for specific CORS error
4. Redeploy backend after CORS changes

### Database Connection Errors
1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas network access (allow all IPs)
3. Verify database user permissions
4. Check Vercel function logs for connection errors

### Environment Variables Not Working
1. Frontend variables must start with `VITE_`
2. Redeploy after adding/changing variables
3. Check variable names are exact (case-sensitive)
4. Verify variables are set for correct environment (Production/Preview)

### Build Failures
1. Check Node.js version (backend requires 22.x)
2. Verify all dependencies in `package.json`
3. Check build logs for specific errors
4. Try clearing `.next` or `dist` folders locally

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- See `VERCEL_DEPLOYMENT.md` for detailed documentation

