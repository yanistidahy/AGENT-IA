# Aura Flow AI Dashboard

Tableau de bord multi-agents IA propulsé par Claude (Anthropic).

## Installation en 3 étapes

**1. Cloner et installer les dépendances**
```bash
cd aura-flow-dashboard
npm install
```

**2. Configurer la clé API**
```bash
cp .env.example .env
# Éditez .env et remplacez your_key_here par votre clé Anthropic
```

**3. Lancer le serveur**
```bash
npm run dev
```

L'app sera disponible sur http://localhost:5173

## Fonctionnalités

- 7 agents IA spécialisés (Pilote, Commercial, Croissance, Marketing, Juridique, SEO, Comptabilité)
- Chat en temps réel avec chaque agent via l'API Anthropic
- Prompts système éditables et sauvegardés en localStorage
- Historique des 5 dernières conversations par agent
- Interface moderne avec sidebar de navigation

## Clé API

Créez votre clé sur https://console.anthropic.com
