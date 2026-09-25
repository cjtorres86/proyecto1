import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { Perfil } from '../../auth/entities/perfil.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

// Crea UN usuario en la base de datos a la que apunte el .env en ese
// momento (local o Aiven). A diferencia de auth.seed.ts, se puede correr
// las veces que haga falta: si el usuario ya existe, no toca nada.
//
// Uso (desde la carpeta backend):
//   npx ts-node -r tsconfig-paths/register src/database/seeds/crear-usuario.ts --usuario=Betania --clave=betaniabetania --nombre=Betania --perfil=perfil_admin --alcance=todos
//
// Perfiles válidos: perfil_admin, perfil_validador, perfil_digitador.
// Alcance: "todos" o el nombre exacto de un SLEP. Si el valor tiene
// espacios, va entre comillas completo: "--alcance=Maule Costa".
function leerArgumentos(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function crearUsuario() {
  const { usuario, clave, nombre, perfil, alcance } = leerArgumentos();
  if (!usuario || !clave || !nombre || !perfil || !alcance) {
    console.error('Faltan datos. Se necesitan: --usuario --clave --nombre --perfil --alcance');
    process.exit(1);
  }

  await dataSource.initialize();
  try {
    const perfilRepo = dataSource.getRepository(Perfil);
    const usuarioRepo = dataSource.getRepository(Usuario);

    if (!(await perfilRepo.findOne({ where: { id: perfil } }))) {
      throw new Error(`El perfil "${perfil}" no existe. Usa perfil_admin, perfil_validador o perfil_digitador.`);
    }
    if (await usuarioRepo.findOne({ where: { usuario } })) {
      console.log(`El usuario "${usuario}" ya existe. No se hizo ningún cambio.`);
      return;
    }

    await usuarioRepo.save(
      usuarioRepo.create({
        usuario,
        contrasenaHash: await bcrypt.hash(clave, 10),
        nombreParaMostrar: nombre,
        esSuperadmin: false,
        perfilId: perfil,
        alcance,
      }),
    );
    console.log(`Usuario "${usuario}" creado (perfil ${perfil}, alcance ${alcance}).`);
  } finally {
    await dataSource.destroy();
  }
}

crearUsuario().catch((err) => {
  console.error('Error al crear el usuario:', err.message ?? err);
  process.exit(1);
});
