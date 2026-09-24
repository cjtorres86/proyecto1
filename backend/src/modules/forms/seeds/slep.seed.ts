import dataSource from '../../../database/data-source';
import { Slep } from '../entities/slep.entity';

// Los 36 SLEP reales (SLEP_CANONICOS en el PMV).
export const SLEP_SEED: Partial<Slep>[] = [
  { nombre: "Aconcagua" },
  { nombre: "Andalién Costa" },
  { nombre: "Andalién Sur" },
  { nombre: "Atacama" },
  { nombre: "Aysén" },
  { nombre: "Barrancas" },
  { nombre: "Chiloé" },
  { nombre: "Chinchorro" },
  { nombre: "Colchagua" },
  { nombre: "Costa Araucanía" },
  { nombre: "Costa Central" },
  { nombre: "Del Pino" },
  { nombre: "Elqui" },
  { nombre: "Gabriela Mistral" },
  { nombre: "Huasco" },
  { nombre: "Iquique" },
  { nombre: "Licancabur" },
  { nombre: "Llanquihue" },
  { nombre: "Los Álamos" },
  { nombre: "Los Andes" },
  { nombre: "Los Libertadores" },
  { nombre: "Los Parques" },
  { nombre: "Magallanes" },
  { nombre: "Marga Marga" },
  { nombre: "Maule Costa" },
  { nombre: "Petorca" },
  { nombre: "Puelche" },
  { nombre: "Puerto Cordillera" },
  { nombre: "Punilla Cordillera" },
  { nombre: "Santa Corina" },
  { nombre: "Santa Rosa" },
  { nombre: "Santiago Centro" },
  { nombre: "Tamarugal" },
  { nombre: "Valdivia" },
  { nombre: "Valle Diguillín" },
  { nombre: "Valparaíso" },
];

export async function seedSlep() {
  const repo = dataSource.getRepository(Slep);
  await repo.save(SLEP_SEED);
  console.log(`${SLEP_SEED.length} SLEP creados.`);
}
