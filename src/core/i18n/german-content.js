import { getCollection } from 'astro:content';

export async function getGermanMaterials() {
  const materials = await getCollection('materi');

  return materials.map((material) => ({
    ...material,
    data: {
      ...material.data,
      title: material.data.judulMateri,
      description: material.data.deskripsi,
      vocab: material.data.vocab.map((entry) => ({
        ...entry,
        word: entry.german,
        translation: entry.indonesian,
        reading_text: entry.lesen_teks,
        reading_question: entry.lesen_pertanyaan,
        listening_audio: entry.hoeren_audio,
        writing_instruction: entry.schreiben_instruksi,
        speaking_question: entry.sprechen_pertanyaan,
      })),
    },
  }));
}

export async function getGermanCareers() {
  const careers = await getCollection('career');

  return careers.map((career) => ({
    ...career,
    data: {
      ...career.data,
      title: career.data.judulMateri,
      description: career.data.deskripsi,
      vocab: career.data.vocab.map((entry) => ({
        ...entry,
        word: entry.german,
        translation: entry.indonesian,
      })),
    },
  }));
}
