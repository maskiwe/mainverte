# 🌱 Main Verte (Mon Jardin d'Intérieur) - PWA v1.8

Application web installable pour suivre ses plantes d'intérieur : identification par photo, diagnostic, planning d'arrosage et rappels.

## 📦 Contenu

- `index.html` - Application principale (React + Tailwind sans build)
- `manifest.json` - Configuration PWA
- `sw.js` - Service Worker (cache, réception des notifications push)
- `icon-192.png` / `icon-512.png` - Icônes
- `netlify/functions/gemini.js` - Proxy vers l'API Gemini (exige une session Supabase)
- `netlify/functions/daily-reminder.js` - Fonction planifiée : envoie les rappels d'arrosage par Web Push
- `netlify.toml`, `package.json` - Configuration Netlify et dépendance `web-push`

## 🧱 Architecture

- **Hébergement** : Netlify (déploiement depuis `main`).
- **Données et connexion** : Supabase (email + mot de passe). Les plantes sont dans la table `plants`, les abonnements aux notifications dans `push_subscriptions` (RLS : chaque utilisateur ne voit que ses lignes). IndexedDB sert de cache hors-ligne.
- **IA** : Gemini, appelé uniquement via la fonction Netlify `gemini` (la clé n'est jamais côté navigateur).
- **Notifications** : à la connexion, l'app abonne l'appareil au Web Push et enregistre l'abonnement dans Supabase. Chaque jour à 07:00 UTC (8h/9h en France), `daily-reminder` lit les plantes et envoie un push aux appareils concernés. Cette lecture quotidienne évite aussi la mise en pause du projet Supabase gratuit.

## 🔑 Variables d'environnement Netlify

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY` | Clé API Gemini (proxy) |
| `VAPID_PUBLIC_KEY` | Clé publique Web Push (aussi présente dans `index.html`) |
| `VAPID_PRIVATE_KEY` | Clé privée Web Push (secrète) |
| `SUPABASE_SECRET_KEY` | Clé serveur Supabase `sb_secret_…` (secrète) |

`VAPID_PUBLIC_KEY` est exclue du scan de secrets Netlify via `netlify.toml`, car elle est publique par conception.

## 🔔 Tester les rappels

1. Ouvrir l'app installée, se connecter (crée l'abonnement push).
2. Mettre la date d'arrosage d'une plante à aujourd'hui ou avant.
3. Netlify → Functions → `daily-reminder` → exécuter.

## 📱 Installation Android

Ouvrir l'URL dans Chrome → ⋮ → Ajouter à l'écran d'accueil → Installer.
