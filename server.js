const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const url = require('url');

const execAsync = promisify(exec);

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS enable
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // এন্ডপয়েন্ট: /download?url=YOUTUBE_URL
    if (path === '/download' && req.method === 'GET') {
        const youtubeUrl = query.url;

        if (!youtubeUrl) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: 'URL parameter missing',
                example: '/download?url=https://www.youtube.com/watch?v=VIDEO_ID'
            }));
            return;
        }

        try {
            const pythonScript = `
import yt_dlp
import json

ydl_opts = {
    'quiet': True,
    'skip_download': True,
    'no_warnings': True,
    'format': 'bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best',
    'ignoreerrors': True,
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info('${youtubeUrl.replace(/'/g, "\\'")}', download=False)
        
        if not info:
            print(json.dumps({"error": "Video not found"}))
        else:
            # Find best MP4 with audio
            best_mp4 = None
            best_audio = None
            
            for f in info['formats']:
                # Video with audio
                if f.get('ext') == 'mp4' and f.get('vcodec') != 'none' and f.get('acodec') != 'none':
                    if not best_mp4 or f.get('height', 0) > best_mp4.get('height', 0):
                        best_mp4 = {
                            'url': f['url'],
                            'quality': f.get('height'),
                            'fps': f.get('fps'),
                            'filesize': f.get('filesize'),
                            'format_id': f.get('format_id')
                        }
                
                # Audio only
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    if not best_audio or f.get('abr', 0) > best_audio.get('abr', 0):
                        best_audio = {
                            'url': f['url'],
                            'abr': f.get('abr'),
                            'ext': f.get('ext'),
                            'filesize': f.get('filesize')
                        }
            
            result = {
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'channel': info.get('channel'),
                'video_url': best_mp4['url'] if best_mp4 else None,
                'audio_url': best_audio['url'] if best_audio else None,
                'video_quality': best_mp4['quality'] if best_mp4 else None
            }
            print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
            `;

            // Python script run
            const { stdout, stderr } = await execAsync(
                `python3 -c "${pythonScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`
            );

            const data = JSON.parse(stdout);
            
            if (data.error) {
                throw new Error(data.error);
            }

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                ...data
            }));

        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Homepage
    if (path === '/' || path === '') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>YouTube Downloader API</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        color: white;
                    }
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 40px;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    }
                    h1 {
                        color: #fff;
                        text-align: center;
                        margin-bottom: 30px;
                        font-size: 2.5em;
                    }
                    code {
                        background: rgba(0, 0, 0, 0.3);
                        padding: 15px;
                        border-radius: 10px;
                        display: block;
                        margin: 20px 0;
                        font-size: 1.1em;
                        border-left: 4px solid #ff4757;
                        overflow-x: auto;
                    }
                    .example {
                        background: rgba(255, 255, 255, 0.15);
                        padding: 20px;
                        border-radius: 15px;
                        margin: 25px 0;
                    }
                    a {
                        color: #74b9ff;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    a:hover {
                        text-decoration: underline;
                    }
                    .endpoint {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #ffdd59;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎬 YouTube Downloader API</h1>
                    
                    <div class="example">
                        <h2>📌 API Endpoint:</h2>
                        <code class="endpoint">GET /download?url=YOUTUBE_URL</code>
                        
                        <h2>📝 Example:</h2>
                        <code>https://${req.headers.host}/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ</code>
                        
                        <p><a href="/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ">🔗 Try this example</a></p>
                    </div>
                    
                    <div class="example">
                        <h2>✅ Features:</h2>
                        <ul>
                            <li>Direct MP4 download links</li>
                            <li>Best quality audio extraction</li>
                            <li>Thumbnail & video information</li>
                            <li>100% working premium quality</li>
                            <li>CORS enabled for web use</li>
                        </ul>
                    </div>
                    
                    <div class="example">
                        <h2>📋 Response Format (JSON):</h2>
                        <code>
{
  "success": true,
  "title": "Video Title",
  "thumbnail": "https://i.ytimg.com/vi/...",
  "duration": 215,
  "channel": "Channel Name",
  "video_url": "https://direct-video-link.mp4",
  "audio_url": "https://direct-audio-link.m4a",
  "video_quality": 1080
}
                        </code>
                    </div>
                    
                    <p style="text-align: center; margin-top: 30px; opacity: 0.8;">
                        Made with ❤️ for premium YouTube downloads
                    </p>
                </div>
            </body>
            </html>
        `);
        return;
    }

    // 404 Not Found
    res.writeHead(404);
    res.end(JSON.stringify({ 
        error: 'Endpoint not found',
        available_endpoints: ['/', '/download?url=YOUTUBE_URL']
    }));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/download?url=YOUTUBE_URL`);
    console.log(`📝 Example: http://localhost:${PORT}/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
});    
    // Homepage
    if (path === '/' || path === '') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
            <head>
                <title>YouTube Downloader API</title>
                <style>
                    body { font-family: Arial; padding: 40px; text-align: center; }
                    h1 { color: #ff0000; }
                    code { background: #eee; padding: 10px; display: block; margin: 20px; }
                </style>
            </head>
            <body>
                <h1>🎬 YouTube Downloader API</h1>
                <p>Use this endpoint to get direct download links:</p>
                <code>GET /download?url=YOUTUBE_URL</code>
                <p>Example: <a href="/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ">/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></p>
                <p>Returns direct MP4 and Audio links in JSON format.</p>
            </body>
            </html>
        `);
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Open: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/download?url=YOUTUBE_URL`);
});
