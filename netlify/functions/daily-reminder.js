// Fonction planifiee (Netlify Scheduled Function) : chaque matin, envoie un Web Push
// aux utilisateurs dont des plantes sont a arroser. Lire Supabase chaque jour evite
// aussi que le projet gratuit soit mis en pause pour inactivite.
const webpush = require('web-push');

const SUPABASE_URL = 'https://ejccsolcvcbhhwhqnfai.supabase.co';

exports.config = { schedule: '0 7 * * *' }; // 07:00 UTC (8h/9h en France)

// Cle serveur : nouvelle "Secret key" (sb_secret_...) ou ancienne service_role (JWT)
const supabaseKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbFetch(path, options = {}) {
    const key = supabaseKey();
    // Les cles sb_secret_ ne sont pas des JWT : uniquement dans l'en-tete apikey
    const headers = key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

function needsWater(p, today) {
    if (p.prescription && new Date(p.prescription.endDate) > new Date() && p.prescription.noWatering) return false;
    return new Date(p.nextWatering + 'T00:00:00') <= today;
}

function buildMessage(plants) {
    if (plants.length === 1) {
        return { title: '💧 ' + plants[0].name + ' a soif !', body: "Il est temps d'arroser cette plante." };
    }
    return { title: '💧 ' + plants.length + ' plantes a arroser', body: plants.map(p => p.name).join(', ') };
}

exports.handler = async () => {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !supabaseKey()) {
        console.error('Variables d\'environnement manquantes (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SECRET_KEY)');
        return { statusCode: 500, body: 'Configuration manquante' };
    }
    webpush.setVapidDetails('mailto:mpierre.icam@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const [plantsResp, subsResp] = await Promise.all([
        sbFetch('plants?select=user_id,data'),
        sbFetch('push_subscriptions?select=endpoint,user_id,subscription')
    ]);
    if (!plantsResp.ok || !subsResp.ok) {
        console.error('Lecture Supabase impossible', plantsResp.status, subsResp.status);
        return { statusCode: 502, body: 'Supabase indisponible' };
    }
    const plantRows = await plantsResp.json();
    const subs = await subsResp.json();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byUser = {};
    for (const row of plantRows) {
        if (needsWater(row.data, today)) (byUser[row.user_id] = byUser[row.user_id] || []).push(row.data);
    }

    let sent = 0, removed = 0;
    for (const sub of subs) {
        const due = byUser[sub.user_id];
        if (!due) continue;
        try {
            await webpush.sendNotification(sub.subscription, JSON.stringify(buildMessage(due)));
            sent++;
        } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) {
                await sbFetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
                removed++;
            } else {
                console.error('Echec push', e.statusCode, e.body);
            }
        }
    }
    console.log(`Rappels: ${sent} envoye(s), ${removed} abonnement(s) expire(s) supprime(s)`);
    return { statusCode: 200, body: JSON.stringify({ sent, removed }) };
};
