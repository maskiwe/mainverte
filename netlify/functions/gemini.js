// Transient Gemini failures worth retrying (overloaded / rate limited / internal)
const RETRY_STATUSES = [429, 500, 503];
const MAX_ATTEMPTS = 3;
// Netlify caps execution at 30s; stop retrying once there is no longer
// room for another call (a Gemini image call runs up to ~10s)
const TIME_BUDGET_MS = 20000;

const SUPABASE_URL = 'https://ejccsolcvcbhhwhqnfai.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqY2Nzb2xjdmNiaGh3aHFuZmFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTg1MjYsImV4cCI6MjEwNDc5NDUyNn0.vzd8WzVceF8Z61iC1FT8aq8PkSrAWWRJmOmYb2QjD5s';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: { message: 'Authentification requise.' } })
        };
    }
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!userResp.ok) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: { message: 'Session invalide.' } })
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: { message: 'GEMINI_API_KEY non configuree sur Netlify.' } })
        };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const started = Date.now();
    let resp, text;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: event.body
        });
        text = await resp.text();

        if (!RETRY_STATUSES.includes(resp.status) || attempt === MAX_ATTEMPTS) break;

        const delay = 1000 * attempt;
        if (Date.now() - started + delay > TIME_BUDGET_MS) break;
        await new Promise(r => setTimeout(r, delay));
    }

    return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json' },
        body: text
    };
};
