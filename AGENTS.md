## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Project reference

- The application is Indonesian-first: dashboard sidebar, header, navigation, and actions use hardcoded Indonesian. `/en` and `/de` select learning modules, not the global UI language.
- Audio and TTS workflows, including local-file dry-run, Grammar/Pronunciation extraction, jsDelivr publication, and Web Speech fallback, are documented in [README.md](README.md) and [HANDOVER.md](HANDOVER.md).
- Shared answer grading and article-specific behavior are in `src/core/game/fuzzy-match.js`; STT pre-roll, 80 Hz–8 kHz band-pass, and 800/2000 ms hangover VAD are in `src/core/speech/recorder.ts`.
- Material progress uses `MAX_MATERIAL_XP = 800`, 4 sessions × 5 vocabulary items, binary pillar bars, and no XP for completed session/pillar retries. Runtime writes/UI clamp XP; `supabase/cap_user_progress_xp.sql` only cleans legacy rows and the table schema has no 800-XP CHECK constraint.
- Quiz/exam text answers submit with Enter (Shift+Enter inserts a newline in textareas); catalog level filters compare case-insensitively. NdBot technical guardrails and WhatsApp support routing are in `src/pages/api/chat.ts`.
- Leaderboard behavior (zero-XP/admin exclusion and Realtime refresh) is implemented in `supabase/leaderboard.sql` and `src/core/ui/Leaderboard.astro`; apply the SQL to the target Supabase project. Check actual SQL grants before describing RPC permissions.
- Run `npm run build` for production-build validation. See [TESTING.md](TESTING.md) for targeted Playwright and feature checks.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
