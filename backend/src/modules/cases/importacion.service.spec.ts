import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { ImportacionService, ProblemaArchivo } from './importacion.service';

// Formulario mínimo de 3 preguntas: SLEP (texto), casos y monto (números).
const PREGUNTAS = [
  { id: 'Q03', nombre: 'Servicio', alias: ['servicio'], tipo: 'select' },
  { id: 'Q04', nombre: 'Casos informados', alias: ['casos informados'], tipo: 'number' },
  { id: 'Q62', nombre: 'Monto descuentos', alias: ['monto descuentos'], tipo: 'money' },
];
const servicio = () =>
  new ImportacionService(
    { find: async () => [{ id: 'c1', slep: 'Valdivia', formularioId: 'f1' }] } as never,
    { find: async () => PREGUNTAS } as never,
    { find: async () => PREGUNTAS.map((p, i) => ({ preguntaId: p.id, posicionCanonica: i + 3, pregunta: p })) } as never,
  );

async function excel(armar: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Datos');
  ws.addRow(['3. Servicio', '4. Casos informados', 'Monto descuentos']);
  armar(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function problemasDe(buffer: Buffer): Promise<ProblemaArchivo[]> {
  try {
    await servicio().leerDesdeExcel('c1', buffer, 'x.xlsx');
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    const r = (e as BadRequestException).getResponse() as { message: string; problemas: ProblemaArchivo[] };
    expect(typeof r.message).toBe('string');
    return r.problemas;
  }
  return [];
}

describe('ImportacionService: archivo limpio y problemas explicados', () => {
  it('un archivo limpio se lee sin problemas', async () => {
    const r = await servicio().leerDesdeExcel('c1', await excel((ws) => ws.addRow(['Valdivia', 12, 1500])), 'x.xlsx');
    expect(r.valores).toEqual({ Q03: 'Valdivia', Q04: '12', Q62: '1500' });
  });

  it('detecta filas y columnas ocultas, celdas combinadas, fórmulas con error y valores no numéricos', async () => {
    const titulos = (await problemasDe(await excel((ws) => {
      ws.addRow(['Valdivia', '12 casos', { formula: '1/0', result: { error: '#DIV/0!' } }]);
      ws.getRow(2).hidden = true;
      ws.getColumn(2).hidden = true;
      ws.mergeCells('D1:E1');
    }))).map((p) => p.titulo);
    expect(titulos).toEqual(expect.arrayContaining(['Hay filas o columnas ocultas', 'Hay celdas combinadas', 'Hay fórmulas con error', 'Hay valores que no son números']));
  });

  it('cada problema dice qué pasó y cómo corregirlo', async () => {
    const problemas = await problemasDe(await excel((ws) => { ws.addRow(['Valdivia', 1, 2]); ws.addRow(['Otra', 3, 4]); }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0].titulo).toBe('Hay 2 filas con datos');
    expect(problemas[0].solucion).toContain('fila 2');
  });

  it('un archivo que no es Excel también se explica', async () => {
    const problemas = await problemasDe(Buffer.from('no soy un excel'));
    expect(problemas[0].titulo).toBe('No pudimos abrir el archivo');
  });
});
