import { Column, Entity, PrimaryColumn } from 'typeorm';

// Catálogo de los 36 SLEP (Servicios Locales de Educación Pública).
// Usuario.alcance y Contenedor.slep siguen siendo texto libre (así se
// fijó en la sección 13.11 del TDD) — esta tabla es la referencia para
// poblar selects y validar nombres, no una FK obligatoria todavía.
@Entity('slep')
export class Slep {
  @PrimaryColumn({ length: 60 })
  nombre: string;
}
