import { destinoSeguro } from './sso.component';

describe('destinoSeguro (ingreso único con destino)', () => {
  it('acepta las páginas de informes de Sumarios', () => {
    expect(destinoSeguro('/informe/Agosto/2026?tipo=ranking&imprimir=1')).toBe('/informe/Agosto/2026?tipo=ranking&imprimir=1');
    expect(destinoSeguro('/informe-avance?mes=Julio&anio=2026&slep=Barrancas')).toBe('/informe-avance?mes=Julio&anio=2026&slep=Barrancas');
    expect(destinoSeguro('/informe-avance')).toBe('/informe-avance');
    expect(destinoSeguro('/informe-ranking?mes=Agosto&anio=2026')).toBe('/informe-ranking?mes=Agosto&anio=2026');
    expect(destinoSeguro('/informe-ranking?imprimir=1&mes=Agosto&anio=2026')).toBe('/informe-ranking?imprimir=1&mes=Agosto&anio=2026');
    expect(destinoSeguro('/descargar?archivo=consolidado-mes')).toBe('/descargar?archivo=consolidado-mes');
  });

  it('rechaza direcciones externas, otras pantallas o rutas raras (vuelve al inicio)', () => {
    for (const malo of [null, '', 'https://otro.sitio', '//otro.sitio/x', '/usuarios', '/informe/x/y', '/descargar/../usuarios', '/informe-avance-falso', '/informe-ranking-falso', '\\\\otro']) {
      expect(destinoSeguro(malo)).toBe('/');
    }
  });
});
