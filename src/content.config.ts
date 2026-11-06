import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const vocabItemSchema = z.object({
  german: z.string(),
  indonesian: z.string(),
  context: z.string(),
  contextIndonesian: z.string().optional(),
});

const materi = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/materi' }),
  schema: z.object({
    track: z.enum(['Alltagsdeutsch', 'Fachdeutsch']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    jurusan: z.string().optional(),
    fakultas: z.string().optional(),
    judulMateri: z.string(),
    deskripsi: z.string(),
    kategori: z.enum(['Vocab Jurusan', 'Bahasa Sehari-hari', 'Tata Bahasa']).optional(),
    vocab: z.array(vocabItemSchema),
    flashcards: z
      .array(
        z.object({
          kata: z.string(),
          arti: z.string(),
          contoh: z.string().optional(),
        })
      )
      .optional(),
  }),
});

const career = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/career' }),
  schema: z.object({
    track: z.literal('Career'),
    judulMateri: z.string(),
    deskripsi: z.string(),
    vocab: z.array(
      z.object({
        german: z.string(),
        indonesian: z.string(),
        context: z.string().optional(),
        contextIndonesian: z.string().optional(),
      })
    ),
  }),
});

export const collections = {
  materi,
  career,
};
