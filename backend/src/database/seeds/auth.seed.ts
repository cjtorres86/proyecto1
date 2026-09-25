import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { Perfil } from '../../auth/entities/perfil.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

// Mismos 3 perfiles predeterminados y los mismos usuarios de ejemplo que
// ya existían en el PMV (TDD, secciones 11.2.4 y 11.2.5) — la contraseña
// es la única diferencia real: acá se guarda hasheada con bcrypt, nunca
// en texto plano como en el localStorage del navegador.
async function seed() {
  await dataSource.initialize();

  const perfilRepo = dataSource.getRepository(Perfil);
  const usuarioRepo = dataSource.getRepository(Usuario);

  const perfiles: Perfil[] = [
    perfilRepo.create({
      id: 'perfil_admin',
      nombre: 'Admin',
      permisos: {
        vistas: ['dashboard', 'formulario', 'inspector'],
        acciones: ['exportar_excel', 'exportar_informe', 'crear_mes'],
        gestion: ['gestionar_usuarios'],
      },
    }),
    perfilRepo.create({
      id: 'perfil_validador',
      nombre: 'Validador (Checker)',
      permisos: {
        vistas: ['dashboard', 'formulario', 'inspector'],
        acciones: ['exportar_excel', 'exportar_informe', 'crear_mes'],
        gestion: [],
      },
    }),
    perfilRepo.create({
      id: 'perfil_digitador',
      nombre: 'Digitador (Maker)',
      permisos: {
        vistas: ['dashboard', 'formulario', 'inspector'],
        acciones: ['exportar_excel', 'exportar_informe', 'editar_formulario'],
        gestion: [],
      },
    }),
  ];
  await perfilRepo.save(perfiles);
  console.log(`${perfiles.length} perfiles creados.`);

  const hash = (clave: string) => bcrypt.hash(clave, 10);

  const usuarios = [
    usuarioRepo.create({
      usuario: 'cesar',
      contrasenaHash: await hash('cesarcesar'),
      nombreParaMostrar: 'César',
      esSuperadmin: true,
      perfilId: null,
      alcance: 'todos',
    }),
    usuarioRepo.create({
      usuario: 'Claudia',
      contrasenaHash: await hash('claudiaclaudia'),
      nombreParaMostrar: 'Claudia',
      esSuperadmin: false,
      perfilId: 'perfil_admin',
      alcance: 'todos',
    }),
    usuarioRepo.create({
      usuario: 'Betania',
      contrasenaHash: await hash('betaniabetania'),
      nombreParaMostrar: 'Betania',
      esSuperadmin: false,
      perfilId: 'perfil_admin',
      alcance: 'todos',
    }),
    usuarioRepo.create({
      usuario: 'Ximena',
      contrasenaHash: await hash('ximenaximena'),
      nombreParaMostrar: 'Ximena',
      esSuperadmin: false,
      perfilId: 'perfil_validador',
      alcance: 'todos',
    }),
    usuarioRepo.create({
      usuario: 'Barrancas',
      contrasenaHash: await hash('barrancasbarrancas'),
      nombreParaMostrar: 'Barrancas',
      esSuperadmin: false,
      perfilId: 'perfil_digitador',
      alcance: 'Barrancas',
    }),
  ];
  await usuarioRepo.save(usuarios);
  console.log(`${usuarios.length} usuarios creados.`);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});
