const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Simple in-memory cache for API responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Simple rate limiting
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

// Cache middleware
const cacheMiddleware = (req, res, next) => {
  const key = `${req.method}:${req.originalUrl}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`💾 Cache hit: ${key}`);
    return res.json(cached.data);
  }
  
  // Store original res.json to intercept
  const originalJson = res.json;
  res.json = function(data) {
    cache.set(key, { data, timestamp: Date.now() });
    return originalJson.call(this, data);
  };
  
  next();
};

// Rate limiting middleware
const rateLimitMiddleware = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit.has(clientIp)) {
    rateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const limit = rateLimit.get(clientIp);
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      limit.count++;
    }
    
    if (limit.count > RATE_LIMIT_MAX) {
      console.warn(`⚠️ Rate limit exceeded for ${clientIp}: ${limit.count} requests`);
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        retryAfter: Math.ceil((limit.resetTime - now) / 1000)
      });
    }
  }
  
  next();
};

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`📡 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`✅ ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Health check endpoint with detailed status
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      size: cache.size,
      keys: Array.from(cache.keys()).slice(0, 5) // Show first 5 cache keys
    },
    rateLimit: {
      activeClients: rateLimit.size,
      totalRequests: Array.from(rateLimit.values()).reduce((sum, limit) => sum + limit.count, 0)
    },
    config: {
      freesoundApiKey: !!FREESOUND_API_KEY,
      pexelsApiKey: !!PEXELS_API_KEY,
      port: PORT
    }
  };
  
  res.json(status);
});

// Freesound proxy endpoint - UPDATED with proper query parameter handling
app.get('/api/freesound', rateLimitMiddleware, cacheMiddleware, async (req, res) => {
  try {
    const { url, ...otherParams } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    if (!FREESOUND_API_KEY) {
      return res.status(500).json({ error: 'Freesound API key not configured' });
    }

    // Build the full URL with ALL parameters including 'fields'
    const queryString = new URLSearchParams(otherParams).toString();
    const freesoundUrl = `https://freesound.org/apiv2/${url}${queryString ? '&' + queryString : ''}`;
    
    console.log(`🔍 Proxying Freesound request: ${freesoundUrl}`);

    const response = await fetch(freesoundUrl, {
      headers: {
        'Authorization': `Token ${FREESOUND_API_KEY}`,
        'User-Agent': 'audiomosh-proxy/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      console.error(`❌ Freesound API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Freesound API error: ${response.status}`,
        details: response.statusText,
        url: freesoundUrl
      });
    }

    const data = await response.json();
    console.log(`✅ Freesound proxy success: ${url} (${data.count || data.results?.length || 'unknown'} results)`);
    res.json(data);

  } catch (error) {
    console.error(`❌ Freesound proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Pexels proxy endpoint - UPDATED with better error handling
app.get('/api/pexels', rateLimitMiddleware, cacheMiddleware, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    if (!PEXELS_API_KEY) {
      return res.status(500).json({ error: 'Pexels API key not configured' });
    }

    const apiUrl = `https://api.pexels.com/videos/${url}`;
    console.log(`🔍 Proxying Pexels request: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': PEXELS_API_KEY,
        'User-Agent': 'audiomosh-proxy/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      console.error(`❌ Pexels API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Pexels API error: ${response.status}`,
        details: response.statusText,
        url: apiUrl
      });
    }

    const data = await response.json();
    console.log(`✅ Pexels proxy success: ${url} (${data.videos?.length || data.total_results || 'unknown'} videos)`);
    res.json(data);

  } catch (error) {
    console.error(`❌ Pexels proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Audio file download proxy (for Freesound) - UPDATED with better streaming
app.get('/api/freesound/download/:id', rateLimitMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!FREESOUND_API_KEY) {
      return res.status(500).json({ error: 'Freesound API key not configured' });
    }

    const downloadUrl = `https://freesound.org/apiv2/sounds/${id}/download/`;
    console.log(`🔍 Proxying Freesound download: ${downloadUrl}`);

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Token ${FREESOUND_API_KEY}`,
        'User-Agent': 'audiomosh-proxy/1.0'
      },
      timeout: 120000 // 2 minute timeout for downloads
    });

    if (!response.ok) {
      console.error(`❌ Freesound download error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Download error: ${response.status}`,
        details: response.statusText,
        soundId: id
      });
    }

    // Forward the audio file with proper headers
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');
    
    res.setHeader('Content-Type', contentType || 'audio/mpeg');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }
    
    console.log(`✅ Freesound download success: ${id} (${contentLength} bytes)`);
    response.body.pipe(res);

  } catch (error) {
    console.error(`❌ Freesound download proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Download proxy error', 
      details: error.message,
      soundId: req.params.id
    });
  }
});

// Video file download proxy (for Pexels) - UPDATED with better streaming
app.get('/api/pexels/download', rateLimitMiddleware, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    console.log(`�� Proxying Pexels video download: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'audiomosh-proxy/1.0'
      },
      timeout: 120000 // 2 minute timeout for downloads
    });

    if (!response.ok) {
      console.error(`❌ Pexels download error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Download error: ${response.status}`,
        details: response.statusText,
        url: url
      });
    }

    // Forward the video file with proper headers
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');
    
    res.setHeader('Content-Type', contentType || 'video/mp4');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }
    
    console.log(`✅ Pexels download success: ${url} (${contentLength} bytes)`);
    response.body.pipe(res);

  } catch (error) {
    console.error(`❌ Pexels download proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Download proxy error', 
      details: error.message,
      url: req.query.url
    });
  }
});

// Cache management endpoint
app.get('/api/cache/status', (req, res) => {
  const cacheStats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    memoryUsage: process.memoryUsage()
  };
  res.json(cacheStats);
});

app.delete('/api/cache/clear', (req, res) => {
  const clearedCount = cache.size;
  cache.clear();
  console.log(`🧹 Cache cleared: ${clearedCount} entries`);
  res.json({ message: `Cache cleared: ${clearedCount} entries` });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/freesound',
      'GET /api/pexels', 
      'GET /api/freesound/download/:id',
      'GET /api/pexels/download',
      'GET /api/cache/status',
      'DELETE /api/cache/clear'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Audiomosh proxy server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Freesound proxy: http://localhost:${PORT}/api/freesound`);
  console.log(`🎬 Pexels proxy: http://localhost:${PORT}/api/pexels`);
  console.log(`💾 Cache status: http://localhost:${PORT}/api/cache/status`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Freesound API: ${FREESOUND_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🔑 Pexels API: ${PEXELS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
});
