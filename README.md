# Audiomosh Proxy Service

A backend proxy service that handles API requests to Pexels and Freesound, solving CORS issues for the Audiomosh frontend application.

## Features

- **Pexels API Proxy**: Handles video search and download requests
- **Freesound API Proxy**: Handles audio search and download requests  
- **CORS Support**: Enables cross-origin requests from the frontend
- **Error Handling**: Comprehensive error handling and logging
- **Health Check**: `/health` endpoint for monitoring

## Environment Variables

Set these environment variables in your deployment:

- `FREESOUND_API_KEY`: Your Freesound API key
- `PEXELS_API_KEY`: Your Pexels API key
- `PORT`: Server port (default: 3001)

## API Endpoints

### Health Check
```
GET /health
```

### Freesound Proxy
```
GET /api/freesound?url=search/text/?query=drum&page=1&page_size=5
```

### Pexels Proxy  
```
GET /api/pexels?url=search?query=mountains&page=1&per_page=5&orientation=landscape
```

### Freesound Download
```
GET /api/freesound/download/:id
```

### Pexels Download
```
GET /api/pexels/download?url=https://player.vimeo.com/external/...
```

## Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Deployment

This service is designed to be deployed on Render.com as a Web Service.

### Render.com Settings

- **Build Command**: `pnpm install --frozen-lockfile`
- **Start Command**: `node server.js`
- **Environment Variables**: Add `FREESOUND_API_KEY` and `PEXELS_API_KEY`

## Frontend Integration

Update your frontend environment variables to point to this proxy:

```env
VITE_PEXELS_PROXY_BASE=https://your-proxy.onrender.com/api/pexels
VITE_FREESOUND_PROXY_BASE=https://your-proxy.onrender.com/api/freesound
```
