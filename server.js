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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Freesound proxy endpoint
app.get('/api/freesound', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    if (!FREESOUND_API_KEY) {
      return res.status(500).json({ error: 'Freesound API key not configured' });
    }

    const apiUrl = `https://freesound.org/apiv2/${url}`;
    console.log(`🔍 Proxying Freesound request: ${apiUrl}`);

    const response = await fetch(apiUrl, {
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
        details: response.statusText
      });
    }

    const data = await response.json();
    console.log(`✅ Freesound proxy success: ${url}`);
    res.json(data);

  } catch (error) {
    console.error(`❌ Freesound proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: error.message 
    });
  }
});

// Pexels proxy endpoint
app.get('/api/pexels', async (req, res) => {
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
        details: response.statusText
      });
    }

    const data = await response.json();
    console.log(`✅ Pexels proxy success: ${url}`);
    res.json(data);

  } catch (error) {
    console.error(`❌ Pexels proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: error.message 
    });
  }
});

// Audio file download proxy (for Freesound)
app.get('/api/freesound/download/:id', async (req, res) => {
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
      timeout: 60000 // 60 second timeout for downloads
    });

    if (!response.ok) {
      console.error(`❌ Freesound download error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Download error: ${response.status}`,
        details: response.statusText
      });
    }

    // Forward the audio file
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    console.log(`✅ Freesound download success: ${id}`);
    response.body.pipe(res);

  } catch (error) {
    console.error(`❌ Freesound download proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Download proxy error', 
      details: error.message 
    });
  }
});

// Video file download proxy (for Pexels)
app.get('/api/pexels/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    console.log(`🔍 Proxying Pexels video download: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'audiomosh-proxy/1.0'
      },
      timeout: 60000 // 60 second timeout for downloads
    });

    if (!response.ok) {
      console.error(`❌ Pexels download error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Download error: ${response.status}`,
        details: response.statusText
      });
    }

    // Forward the video file
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    console.log(`✅ Pexels download success: ${url}`);
    response.body.pipe(res);

  } catch (error) {
    console.error(`❌ Pexels download proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Download proxy error', 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Audiomosh proxy server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Freesound proxy: http://localhost:${PORT}/api/freesound`);
  console.log(`🎬 Pexels proxy: http://localhost:${PORT}/api/pexels`);
}); 