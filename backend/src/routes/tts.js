// src/routes/tts.js
// Malayalam TTS Proxy — fetches Google Translate TTS server-side (no CORS issue)
// GET /api/tts?text=ആകെ+നൂറ്+രൂപ+ആകും

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

/**
 * GET /api/tts
 * Query params:
 *   text  — Malayalam text to speak
 *   lang  — language code (default: ml)
 */
router.get('/', async (req, res) => {
  const text = req.query.text;
  const lang = req.query.lang || 'ml';

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text query param required' });
  }

  const encoded = encodeURIComponent(text.trim());
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=gtx&total=1&idx=0`;

  try {
    const protocol = ttsUrl.startsWith('https') ? https : http;
    
    const proxyReq = protocol.get(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,*/*;q=0.8',
      },
    }, (upstreamRes) => {
      // If redirect, follow it
      if (upstreamRes.statusCode === 302 || upstreamRes.statusCode === 301) {
        const location = upstreamRes.headers['location'];
        if (location) {
          const redirectProto = location.startsWith('https') ? https : http;
          const redReq = redirectProto.get(location, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }, (redRes) => {
            res.set('Content-Type', redRes.headers['content-type'] || 'audio/mpeg');
            res.set('Cache-Control', 'public, max-age=86400');
            res.set('Access-Control-Allow-Origin', '*');
            redRes.pipe(res);
          });
          redReq.on('error', () => res.status(502).json({ error: 'TTS redirect fetch failed' }));
          return;
        }
      }

      if (upstreamRes.statusCode !== 200) {
        return res.status(502).json({ error: `Google TTS returned ${upstreamRes.statusCode}` });
      }

      res.set('Content-Type', upstreamRes.headers['content-type'] || 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      upstreamRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[TTS Proxy] Error:', err.message);
      res.status(502).json({ error: 'TTS fetch failed' });
    });

    proxyReq.setTimeout(8000, () => {
      proxyReq.destroy();
      res.status(504).json({ error: 'TTS request timeout' });
    });

  } catch (err) {
    console.error('[TTS Proxy] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
