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
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: event.body
    });
    const text = await resp.text();

    return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json' },
        body: text
    };
};
