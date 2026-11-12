import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const vocabItemSchema = z.object({
  german: z.string(),
  indonesian: z.string(),
  context: z.string(),
  contextIndonesian: z.string().optional(),
  lesen_teks: z.string().optional(),
  lesen_pertanyaan: z.string().optional(),
  hoeren_audio: z.string().optional(),
  schreiben_instruksi: z.string().optional(),
  sprechen_pertanyaan: z.string().optional(),
});

const materi = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/german/content/materi' }),
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
  loader: glob({ pattern: '**/*.md', base: './src/modules/german/content/career' }),
  schema: z.object({
    track: z.literal('Career'),
    judulMateri: z.string(),
    deskripsi: z.string(),
    boss_questions: z.array(
      z.object({
        question: z.string(),
        keywords: z.array(z.string()),
      })
    ).optional(),
    vocab: z.array(
      z.object({
        german: z.string(),
        indonesian: z.string(),
        context: z.string().optional(),
        contextIndonesian: z.string().optional(),
        lesen_teks: z.string().optional(),
        lesen_pertanyaan: z.string().optional(),
        hoeren_audio: z.string().optional(),
        schreiben_instruksi: z.string().optional(),
        sprechen_pertanyaan: z.string().optional(),
      })
    ),
  }),
});

const englishEveryday = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/english/content/everyday' }),
  schema: z.object({
    title: z.string().optional(),
    judulMateri: z.string().optional(),
    description: z.string().optional(),
    deskripsi: z.string().optional(),
    track: z.enum(['Everyday English', 'Academic English']).optional(),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    vocab: z.array(z.object({
      word: z.string(),
      translation: z.string(),
      context: z.string(),
      contextIndonesian: z.string().optional(),
      reading_text: z.string().optional(),
      reading_question: z.string().optional(),
      listening_audio: z.string().optional(),
      writing_instruction: z.string().optional(),
      speaking_question: z.string().optional(),
    })),
  }),
});

const englishAcademic = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/english/content/academic' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    jurusan: z.string(),
    vocab: z.array(z.object({
      word: z.string(),
      translation: z.string(),
      context: z.string(),
      contextIndonesian: z.string(),
      reading_text: z.string().optional(),
      reading_question: z.string().optional(),
      listening_audio: z.string().optional(),
      writing_instruction: z.string().optional(),
      speaking_question: z.string().optional(),
    })),
    reading_text: z.string().optional(),
    reading_question: z.string().optional(),
    listening_audio: z.string().optional(),
    writing_instruction: z.string().optional(),
    speaking_question: z.string().optional(),
  }),
});

const englishCareer = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/english/content/career' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    vocab: z.array(z.object({
      word: z.string(),
      translation: z.string(),
      context: z.string(),
      contextIndonesian: z.string(),
    })).length(50),
    boss_questions: z.array(z.object({
      question: z.string(),
      keywords: z.array(z.string()).length(3),
    })).length(10),
  }),
});

const englishExam = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/modules/english/content/exam' }),
  schema: z.object({
    exam_type: z.enum(['ielts', 'toefl']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    reading: z.array(z.union([
      z.object({
        passage: z.string(),
        question: z.string(),
        options: z.array(z.string()),
        answer: z.string(),
      }),
      z.object({
        passage: z.string(),
        questions: z.array(z.object({
          question: z.string(),
          options: z.array(z.string()),
          answer: z.string(),
        })),
      }),
    ])),
    listening: z.array(z.union([
      z.object({
        transcript: z.string(),
        question: z.string(),
        options: z.array(z.string()),
        answer: z.string(),
      }),
      z.object({
        transcript: z.string(),
        questions: z.array(z.object({
          question: z.string(),
          options: z.array(z.string()),
          answer: z.string(),
        })),
      }),
    ])),
    writing: z.union([
      z.string(),
      z.object({
        task1: z.string(),
        task2: z.string(),
      }),
      z.object({
        integrated: z.string(),
        academic_discussion: z.string(),
      }),
    ]),
    speaking: z.union([
      z.object({
        question: z.string(),
        keywords: z.array(z.string()).length(3),
      }),
      z.object({
        parts: z.array(z.object({
          part: z.string(),
          question: z.string(),
          keywords: z.array(z.string()).length(3),
        })).length(3),
      }),
    ]),
  }),
});

export const collections = {
  materi,
  career,
  englishEveryday,
  englishAcademic,
  englishCareer,
  englishExam,
};
