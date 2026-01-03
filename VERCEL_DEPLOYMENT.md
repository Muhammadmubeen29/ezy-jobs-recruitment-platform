# Vercel Deployment Guide for EZYJOBS

This document outlines the deployment configuration for the EZYJOBS project on Vercel.

## Project Structure

- **Frontend**: `client/` - React + Vite application
- **Backend**: `server/` - Express.js API server
- **ML Services**: `ml-services/` - Python Flask service (deploy separately on Render/Heroku)

## Deployment Strategy

### Option 1: Separate Vercel Projects (Recommended)

Deploy frontend and backend as separate Vercel projects for better isolation and scaling.

#### Frontend Deployment (`client/`)

1. **Create a new Vercel project** and connect it to your repository
2. **Root Directory**: Set to `client`
3. **Framework Preset**: Vite
4. **Build Command**: `npm run build` (default)
5. **Output Directory**: `dist` (default)
6. **Install Command**: `npm install` (default)

#### Backend Deployment (`server/`)

1. **Create a new Vercel project** and connect it to your repository
2. **Root Directory**: Set to `server`
3. **Framework Preset**: Other
4. **Build Command**: Leave empty (no build step needed)
5. **Output Directory**: Leave empty
6. **Install Command**: `npm install`

### Option 2: Monorepo Deployment

Deploy both frontend and backend from a single Vercel project using the root `vercel.json` configuration.

## Environment Variables

### Frontend Environment Variables (`client/` project)

Add these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend API URL (Vercel backend URL) | `https://your-backend.vercel.app` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` or `pk_test_...` |
| `VITE_GA_TRACKING_ID` | Google Analytics tracking ID | `G-XXXXXXXXXX` |

### Backend Environment Variables (`server/` project)

Add these in Vercel Dashboard → Project Settings → Environment Variables:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Vercel handles this) | `3000` (optional) |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `JWT_ACCESS_TOKEN_SECRET` | JWT access token secret (min 32 chars) | `your-secret-key-here-minimum-32-characters` |
| `JWT_REFRESH_TOKEN_SECRET` | JWT refresh token secret (min 32 chars) | `your-refresh-secret-key-here-minimum-32-characters` |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiration | `30d` |

#### URLs & CORS

| Variable | Description | Example |
|----------|-------------|---------|
| `SERVER_URL` | Backend server URL (Vercel URL) | `https://your-backend.vercel.app` |
| `CLIENT_URL` | Frontend client URL (Vercel URL) | `https://your-frontend.vercel.app` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `https://your-frontend.vercel.app,https://www.your-frontend.vercel.app` |

#### Email Configuration (Nodemailer)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODEMAILER_SMTP_USER` | Gmail account email | `your-email@gmail.com` |
| `NODEMAILER_SMTP_PASS` | Gmail app password | `your-app-password` |
| `NODEMAILER_SMTP_EMAIL` | From email address | `your-email@gmail.com` |

#### Stripe Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` or `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |

#### AI/ML Service Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AI_SERVER_URL` | ML service URL (Render/Heroku) | `https://your-ml-service.onrender.com` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INTERNAL_API_KEY` | Internal service authentication key | - |
| `INTERNAL_SERVICE_USER_ID` | Internal service user ID | `internal-service` |

## Deployment Steps

### 1. Deploy Backend First

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your repository
4. Configure:
   - **Root Directory**: `server`
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
5. Add all backend environment variables
6. Deploy

**Note**: Copy the deployment URL (e.g., `https://your-backend.vercel.app`)

### 2. Deploy Frontend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your repository
4. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
5. Add frontend environment variables:
   - Set `VITE_SERVER_URL` to your backend Vercel URL
6. Deploy

### 3. Update CORS in Backend

After deploying frontend, update the backend `CORS_ORIGIN` environment variable to include your frontend URL:

```
CORS_ORIGIN=https://your-frontend.vercel.app,https://www.your-frontend.vercel.app
```

Then redeploy the backend.

## Important Notes

### Socket.io Limitations

⚠️ **Socket.io and WebRTC features will not work in Vercel serverless functions** because:
- Serverless functions are stateless and don't support persistent WebSocket connections
- Each request is handled by a separate function instance

**Workaround Options**:
1. Deploy backend to a platform that supports WebSockets (Railway, Render, Fly.io)
2. Use a separate WebSocket service (Ably, Pusher, or Socket.io Cloud)
3. Keep real-time features disabled in serverless mode

### Database Connection

- MongoDB connection is established on cold start (first request)
- Connection is reused for subsequent requests in the same function instance
- Consider using MongoDB connection pooling for better performance

### File Uploads

- Vercel serverless functions have a 4.5MB request body limit
- For larger file uploads, consider:
  - Using Vercel Blob Storage
  - Direct upload to cloud storage (AWS S3, Cloudinary)
  - Using a separate file upload service

## Verification Checklist

After deployment, verify:

- [ ] Frontend loads correctly
- [ ] API endpoints respond (test `/api/v1/test`)
- [ ] Authentication works (login/register)
- [ ] Database connections work
- [ ] CORS allows frontend requests
- [ ] Environment variables are set correctly
- [ ] Email sending works (test email verification)
- [ ] Stripe integration works (test payment flow)

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `CORS_ORIGIN` includes your frontend URL
   - Check that URLs don't have trailing slashes
   - Verify credentials are enabled in frontend requests

2. **Database Connection Errors**
   - Verify `MONGODB_URI` is correct
   - Check MongoDB Atlas IP whitelist (allow all IPs: `0.0.0.0/0`)
   - Ensure database user has correct permissions

3. **Environment Variables Not Loading**
   - Variables must be prefixed with `VITE_` for frontend
   - Redeploy after adding/changing environment variables
   - Check variable names match exactly (case-sensitive)

4. **Build Failures**
   - Check Node.js version compatibility (backend uses Node 22.x)
   - Verify all dependencies are in `package.json`
   - Check build logs for specific errors

5. **404 Errors on Frontend Routes**
   - Ensure `vercel.json` has proper rewrites configuration
   - Verify SPA routing is configured correctly

## Support

For deployment issues, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- Project README.md for local development setup

