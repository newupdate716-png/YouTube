const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');
    
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({
            ok: false,
            error: 'YouTube URL is required',
            example: 'https://your-app.vercel.app/api/download?url=YOUTUBE_URL'
        });
    }
    
    try {
        const pythonCode = `
import yt_dlp
import json
import sys

def get_video_info(video_url):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'format': 'best[ext=mp4]/best',
        'ignoreerrors': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        
        if not info:
            return {"ok": False, "error": "Video not found"}
        
        # Get best format
        best_format = None
        for f in info.get('formats', []):
            if f.get('ext') == 'mp4' and f.get('vcodec') != 'none':
                if not best_format or f.get('height', 0) > best_format.get('height', 0):
                    best_format = f
        
        if not best_format:
            return {"ok": False, "error": "No MP4 format found"}
        
        return {
            "ok": True,
            "title": info.get('title', ''),
            "thumbnail": info.get('thumbnail', ''),
            "duration": info.get('duration', 0),
            "channel": info.get('channel', ''),
            "url": best_format['url'],
            "quality": best_format.get('height', ''),
            "filesize": best_format.get('filesize', 0)
        }

result = get_video_info("${url}")
print(json.dumps(result))
        `;
        
        const { stdout } = await execAsync(
            `python3 -c "${pythonCode.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
        );
        
        const data = JSON.parse(stdout);
        
        if (!data.ok) {
            throw new Error(data.error || 'Failed');
        }
        
        res.status(200).json(data);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}; 
