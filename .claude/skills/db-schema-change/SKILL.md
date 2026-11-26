---
name: db-schema-change
description: Change the database schema (add or modify a Prisma model or field) in this project. Use when editing prisma/schema.prisma or when a feature needs new stored data.
---

# Changing the Prisma schema

The database is **PostgreSQL** (`prisma/schema.prisma`, `provider = "postgresql"`). The old `prisma/migrations/` folder and `prisma/dev.db` come from an earlier SQLite version and are not used. The schema is applied with `prisma db push`.

## Steps

1. Edit `prisma/schema.prisma`.
   - New fields on existing tables must be optional (`String?`) or have a `@default(...)`, otherwise `db push` fails on existing rows.
   - New per-user models get `userId Int` (no default) and `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`, plus `@@index([userId, …])`, like `FoodLog`. Cascade makes guest expiry delete the data too.
   - Changing an `@id` default or adding a unique constraint: preview with `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` first. A switch to `autoincrement()` creates a sequence starting at 1, so move it past existing ids with `setval` afterwards.
   - Dates the UI groups by day are `String` in `YYYY-MM-DD` (see `FoodLog.date`), not `DateTime`.
   - Add `@@index` for fields you filter by often (`[userId, date]`).
2. Regenerate the client: `npx prisma generate`
3. Type-check: `npx tsc --noEmit`. Fix every place that creates the model (route handlers **and** `lib/telegram-bot.ts`).
4. Apply to a database **only when the user confirms which database**. `DATABASE_URL` may point at the production Neon database:
   ```bash
   npx prisma db push
   ```
   Never pass `--accept-data-loss` without explicit approval. Renaming or removing a column is data loss: suggest adding a new field and migrating the data instead.
5. Update the data model table in `docs/ARCHITECTURE.md`.

## Don'ts

- Don't put database URLs or credentials in commands that get saved to `.claude/settings.local.json` or any committed file.
- Don't switch to `prisma migrate` on your own; that's a project decision for the user.
