## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Project reference

- The application is Indonesian-first: dashboard sidebar, header, navigation, and actions use hardcoded Indonesian. `/en` and `/de` select learning modules, not the global UI language.
- Audio and TTS workflows, including local-file dry-run, Grammar/Pronunciation extraction, jsDelivr publication, and Web Speech fallback, are documented in [README.md](README.md) and [HANDOVER.md](HANDOVER.md).
- Shared answer grading and article-specific behavior are in `src/core/game/fuzzy-match.js`; microphone noise filtering and dynamic VAD are in `src/core/speech/recorder.ts`.
- Dashboard progress/remaining XP is derived from `user_progress` on the English and German dashboard routes. Leaderboard RPC deployment requires applying `supabase/leaderboard.sql` to the target Supabase project.
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
