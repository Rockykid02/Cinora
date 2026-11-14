# CINORA

**BEYOND THE SCREEN. INTO THE STORY.**  
Created by Sage Dickson · A Digital Dynamo Lab Production

CINORA is a Vite-powered movie and TV discovery experience using TMDB for catalogue metadata. The project includes a cinematic intro, discovery rows, search, details, trailer viewing, watchlist, continue-watching storage, TV season/episode browsing, and a configurable authorised embed-player adapter.

## Run locally

1. Install Node.js.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and add your TMDB API key to `TMDB_API_KEY`.
4. Run `npm run dev` and open the local URL Vite prints.

The app first tries the same-origin `/api/tmdb` proxy. For local development, if you have not configured the serverless proxy, it can use a browser key configured in `src/js/api/tmdb.js` for private testing. **A browser key is visible to every visitor. Never publish a real key in client-side code.**

## Deploy to Vercel

Import the GitHub repository into Vercel, add `TMDB_API_KEY` under Project Settings → Environment Variables, then deploy. The included `api/tmdb.js` function proxies TMDB requests server-side.

## Streaming provider

TMDB supplies metadata and artwork; it does not provide movie or episode streams. The player adapter in `src/js/app.js` is intentionally configurable. Add only an embed provider and content sources that you own, license, or are otherwise authorised to use. Availability is provider-dependent; a TMDB title ID does not guarantee a playable stream.

## Project structure

```text
CINORA/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── .env.example
├── README.md
├── vercel.json
├── src/
│   ├── styles/main.css
│   └── js/
│       ├── api/tmdb.js
│       ├── utils/storage.js
│       └── app.js
└── api/tmdb.js
```

## Credits

Movie and TV metadata provided by [The Movie Database (TMDB)](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.
