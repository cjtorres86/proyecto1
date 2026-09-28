import dataSource from '../data-source';
import { Slep } from '../../modules/forms/entities/slep.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

// Cuentas pendientes por SLEP (mejora post-v2.23): para cada uno de los
// 36 SLEP del catálogo que todavía no tenga una cuenta real asociada
// (alcance = ese SLEP), crea una fila "pendiente" — perfil Digitador, su
// SLEP como alcance, pero SIN usuario ni contraseña. Nadie puede entrar
// con una cuenta así (AuthService.validarCredenciales la rechaza) hasta
// que un Admin le asigne usuario+clave desde la pantalla Usuarios, o
// hasta que se le asocie un RUT el día que se conecte ClaveÚnica.
//
// Idempotente, como crear-usuario.ts: se puede correr las veces que
// haga falta — un SLEP que ya tiene cuenta (real o pendiente) se salta,
// nunca se duplica.
//
// Uso (desde la carpeta backend), contra la base que apunte el .env:
//   npx ts-node -r tsconfig-paths/register src/database/seeds/crear-slep-pendientes.ts
async function crearPendientes() {
  await dataSource.initialize();
  try {
    const slepRepo = dataSource.getRepository(Slep);
    const usuarioRepo = dataSource.getRepository(Usuario);

    const catalogo = await slepRepo.find({ order: { nombre: 'ASC' } });
    const conCuenta = new Set((await usuarioRepo.find({ select: ['alcance'] })).map((u) => u.alcance));

    let creados = 0;
    for (const slep of catalogo) {
      if (conCuenta.has(slep.nombre)) {
        console.log(`- ${slep.nombre}: ya tiene una cuenta (activa o pendiente). Se salta.`);
        continue;
      }
      await usuarioRepo.save(
        usuarioRepo.create({
          usuario: null,
          contrasenaHash: null,
          rut: null,
          nombreParaMostrar: slep.nombre,
          esSuperadmin: false,
          activo: true,
          perfilId: 'perfil_digitador',
          alcance: slep.nombre,
        }),
      );
      console.log(`+ ${slep.nombre}: cuenta pendiente creada.`);
      creados++;
    }
    console.log(`\nListo: ${creados} cuentas pendientes creadas, ${catalogo.length - creados} SLEP ya tenían cuenta.`);
  } finally {
    await dataSource.destroy();
  }
}

crearPendientes().catch((err) => {
  console.error('Error al crear las cuentas pendientes:', err.message ?? err);
  process.exit(1);
});
