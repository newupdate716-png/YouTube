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
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');
    
    // এন্ডপয়েন্ট: /download?url=YOUTUBE_URL
    if (path === '/download' && req.method === 'GET') {
        const youtubeUrl = query.url;
        
        if (!youtubeUrl) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: 'URL parameter missing',
                example: '/download?url=https://youtube.com/watch?v=xxx'
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
