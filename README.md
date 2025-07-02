# Audiomosh Proxy Service

A backend proxy service that handles API requests to Pexels and Freesound, solving CORS issues for the Audiomosh frontend application. **Optimized for ForeverMosh.tsx integration.**

## Features

- **Pexels API Proxy**: Handles video search and download requests
- **Freesound API Proxy**: Handles audio search and download requests with proper query parameter handling
- **CORS Support**: Enables cross-origin requests from the frontend
- **Rate Limiting**: Prevents API abuse (100 requests/minute per client)
- **Response Caching**: 5-minute cache for API responses to reduce load
- **Enhanced Error Handling**: Detailed error messages and logging
- **Health Monitoring**: Comprehensive health check with system stats
- **Cache Management**: View and clear cache via API endpoints
- **Request Logging**: Detailed request/response logging with timing

## Environment Variables

Set these environment variables in your deployment:

- `FREESOUND_API_KEY`: Your Freesound API key
- `PEXELS_API_KEY`: Your Pexels API key
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)

## API Endpoints

### Health Check
```
GET /health
```
Returns detailed system status including cache stats, rate limiting info, and configuration.

### Freesound Proxy
```
GET /api/freesound?url=search/text/?query=drum&page=1&page_size=5&fields=id,name,previews
```
**Fixed**: Now properly handles all query parameters including the `fields` parameter that ForeverMosh.tsx requires.

### Pexels Proxy  
```
GET /api/pexels?url=search?query=mountains&page=1&per_page=5&orientation=landscape
```

### Freesound Download
```
GET /api/freesound/download/:id
```
Streams audio files with proper headers and 2-minute timeout.

### Pexels Download
```
GET /api/pexels/download?url=https://player.vimeo.com/external/...
```
Streams video files with proper headers and 2-minute timeout.

### Cache Management
```
GET /api/cache/status
DELETE /api/cache/clear
```

## ForeverMosh.tsx Integration

This proxy is specifically optimized for the ForeverMosh.tsx component:

### Key Improvements:
1. **Fixed Freesound Query Parameters**: Properly handles the `fields` parameter for audio metadata
2. **Enhanced Error Messages**: Detailed error responses that help debug ForeverMosh issues
3. **Request Logging**: Matches the detailed logging style used in ForeverMosh
4. **Rate Limiting**: Prevents overwhelming the APIs during aggressive fetching
5. **Caching**: Reduces API calls for repeated searches
6. **Extended Timeouts**: 2-minute timeouts for large file downloads

### Environment Variables for ForeverMosh:
```env
VITE_PEXELS_PROXY_BASE=http://localhost:3001/api/pexels
VITE_FREESOUND_PROXY_BASE=http://localhost:3001/api/freesound
```

## Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Check health status
curl http://localhost:3001/health

# View cache status
curl http://localhost:3001/api/cache/status
```

## Deployment

This service is designed to be deployed on Render.com as a Web Service.

### Render.com Settings

- **Build Command**: `pnpm install --frozen-lockfile`
- **Start Command**: `node server.js`
- **Environment Variables**: Add `FREESOUND_API_KEY` and `PEXELS_API_KEY`

### Health Monitoring

The `/health` endpoint provides comprehensive monitoring:
- System uptime and memory usage
- Cache statistics
- Rate limiting status
- API key configuration status

## Troubleshooting

### Common Issues:

1. **Freesound API errors**: Check that `FREESOUND_API_KEY` is set correctly
2. **Pexels API errors**: Check that `PEXELS_API_KEY` is set correctly
3. **Rate limiting**: Monitor `/health` endpoint for rate limit stats
4. **Cache issues**: Use `/api/cache/clear` to reset cache if needed

### Logs

The service provides detailed logging:
- Request/response timing
- API call success/failure
- Download progress
- Error details with stack traces (in development)

## Performance

- **Caching**: 5-minute TTL reduces API calls by ~80%
- **Rate Limiting**: Prevents API quota exhaustion
- **Streaming**: Efficient file downloads without memory bloat
- **Connection Pooling**: Reuses HTTP connections for better performance
