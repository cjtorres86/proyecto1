import dataSource from '../data-source';
import { seedSlep } from '../../modules/forms/seeds/slep.seed';
import { seedPreguntas } from '../../modules/forms/seeds/preguntas.seed';
import { seedFormularios } from '../../modules/forms/seeds/formularios.seed';

async function run() {
  await dataSource.initialize();
  await seedSlep();
  await seedPreguntas();
  await seedFormularios();
  await dataSource.destroy();
}
run().catch((err) => { console.error(err); process.exit(1); });
