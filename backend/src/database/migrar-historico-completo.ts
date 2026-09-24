// Migración de los 14 meses históricos reales del PMV a MySQL (F14 —
// Cutover). Generaliza el script de un solo mes que se usó para la
// validación en paralelo de F13 (Agosto 2025) — mismo algoritmo, ahora
// para los 14 meses completos, la migración real que se correría antes
// de retirar el PMV.
import * as fs from 'fs';
import * as path from 'path';
import dataSource from './data-source';
import { Contenedor } from '../modules/cases/entities/contenedor.entity';
import { ValorCampo } from '../modules/cases/entities/valor-campo.entity';
import { Slep } from '../modules/forms/entities/slep.entity';

const POSICION_A_PREGUNTA: Record<number, string> = {
  1: 'Q01', 2: 'Q02', 3: 'Q03', 4: 'Q04', 5: 'Q05', 6: 'Q06', 7: 'Q07',
  8: 'YA_NO_ESTAN', 9: 'CESARON', 10: 'YA_SUMARIADOS', 11: 'Q15', 12: 'Q16',
  13: 'Q17', 14: 'Q18', 15: 'Q19', 16: 'Q20', 17: 'Q21', 18: 'Q22', 19: 'Q23',
  20: 'CIC_9', 21: 'CIC_10', 22: 'CIC_13', 23: 'CIC_14', 24: 'CIC_15',
  25: 'CIC_16', 26: 'CIC_21', 27: 'Q37', 28: 'Q38', 29: 'Q42', 30: 'Q43',
  31: 'Q44', 32: 'Q45', 33: 'CENSURA', 34: 'Q48', 35: 'Q49', 36: 'Q50', 37: 'Q51',
};

function normalizarClaveSlep(t: string): string {
  let s = String(t ?? '').trim();
  s = s.replace(/^de\s+/i, '');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface MesSemilla { mes: string; anio: string; noAplican: string[]; filas: string[][] }

async function migrar() {
  await dataSource.initialize();
  const contenedorRepo = dataSource.getRepository(Contenedor);
  const valorRepo = dataSource.getRepository(ValorCampo);
  const slepRepo = dataSource.getRepository(Slep);

  const sleps = await slepRepo.find();
  const indiceSlep = new Map(sleps.map((s) => [normalizarClaveSlep(s.nombre), s.nombre]));

  const todosLosMeses: Record<string, MesSemilla> = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'todos_los_meses_semilla.json'), 'utf-8'),
  );

  let totalContenedores = 0, totalValores = 0, mesesOmitidos = 0;

  for (const clave of Object.keys(todosLosMeses)) {
    const { mes, anio, noAplican, filas } = todosLosMeses[clave];

    const yaExiste = await contenedorRepo.findOne({ where: { mesConsolidado: mes, anioConsolidado: anio } });
    if (yaExiste) { console.log(`${mes} ${anio} ya estaba migrado — se omite.`); mesesOmitidos++; continue; }

    for (const fila of filas) {
      const slepCrudo = fila[2];
      const slep = indiceSlep.get(normalizarClaveSlep(slepCrudo));
      if (!slep) { console.warn('SLEP no reconocido, se omite:', JSON.stringify(slepCrudo), 'en', mes, anio); continue; }

      const contenedor = contenedorRepo.create({
        slep, mesConsolidado: mes, anioConsolidado: anio,
        formularioId: 'seguimiento_disciplinario_37', status: 'pending', filled: 0, total: 37,
      });
      const guardado = await contenedorRepo.save(contenedor);

      const valores: ValorCampo[] = [];
      fila.forEach((valorCrudo, idx) => {
        const posicion = idx + 1;
        const campoNoAplica = noAplican.includes('c' + String(posicion).padStart(2, '0'));
        if (campoNoAplica || valorCrudo === '' || valorCrudo == null) return;
        const preguntaId = POSICION_A_PREGUNTA[posicion];
        if (!preguntaId) return;
        valores.push(valorRepo.create({ contenedorId: guardado.id, preguntaId, valor: String(valorCrudo) }));
      });
      await valorRepo.save(valores);
      guardado.filled = valores.length;
      await contenedorRepo.save(guardado);
      totalValores += valores.length;
      totalContenedores++;
    }
    console.log(`${mes} ${anio}: migrado (${filas.length} SLEP).`);
  }

  console.log(`\nResumen: ${totalContenedores} contenedores, ${totalValores} valores de campo, ${mesesOmitidos} meses ya existentes omitidos.`);
  await dataSource.destroy();
}

migrar().catch((err) => { console.error(err); process.exit(1); });
