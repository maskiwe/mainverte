# 🌱 Mon Jardin d'Intérieur - PWA v1.2

## 📦 Contenu

- `index.html` - Application principale
- `manifest.json` - Configuration PWA
- `sw.js` - Service Worker (hors ligne)
- `icon-192.png` / `icon-512.png` - Icônes

## 🚀 Déploiement Netlify

1. Va sur https://app.netlify.com/drop
2. Glisse le dossier entier
3. C'est en ligne !

## 📱 Installation Android

1. Ouvre l'URL Netlify dans Chrome
2. Ajoute à l'écran d'accueil
3. L'app apparaît comme une vraie app

## ✅ Changements v1.2

- **Fix stockage** : Utilise localStorage au lieu de window.storage (qui ne fonctionne que dans les artifacts Claude)
- **Fix JSON Gemini** : Parsing robuste avec fallbacks multiples, suppression du responseSchema problématique
- **Fix arrosage** : Le bouton "J'ai arrosé" met à jour correctement l'état ET sauvegarde
- **Fix dates** : Calcul des jours corrigé (timezone-safe)
- **Service Worker** : Stratégie Network First pour les mises à jour rapides
- **Manifest** : Encodage UTF-8 corrigé
- **Planning** : Bouton arroser directement depuis le calendrier
- **UX** : Feedback visuel lors de l'arrosage, dates en français

## 🔑 Configuration

1. Ouvre l'app → Réglages
2. Entre ta clé API Gemini (https://aistudio.google.com/app/apikey)
3. Active les notifications

## 💰 Coût

- Gemini gratuit : 1500 requêtes/jour
- Hébergement Netlify : gratuit

Bon jardinage ! 🌿
