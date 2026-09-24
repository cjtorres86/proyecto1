import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  function crearServicioConMocks(usuarioExistente: any = null) {
    const usuariosRepo = {
      findOne: jest.fn().mockResolvedValue(usuarioExistente),
      create: jest.fn((x) => x),
      save: jest.fn((x) => ({ id: 'nuevo-id', contrasenaHash: 'hash-falso', ...x })),
      find: jest.fn(),
    };
    const perfilesRepo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn((x) => x), find: jest.fn() };
    return { service: new UsersService(usuariosRepo as any, perfilesRepo as any), usuariosRepo };
  }

  it('rechaza crear un usuario con nombre ya existente', async () => {
    const { service } = crearServicioConMocks({ usuario: 'cesar' });
    await expect(
      service.crearUsuario({ usuario: 'cesar', contrasena: 'x', nombreParaMostrar: 'X', alcance: 'todos' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('nunca devuelve contrasenaHash al crear un usuario', async () => {
    const { service } = crearServicioConMocks(null);
    const resultado = await service.crearUsuario({
      usuario: 'nuevo', contrasena: 'clave123', nombreParaMostrar: 'Nuevo', alcance: 'Valdivia', perfilId: 'perfil_digitador',
    });
    expect('contrasenaHash' in resultado).toBe(false);
  });

  it('un superadmin nuevo no debe quedar con perfilId, aunque se lo hayan mandado', async () => {
    const { service, usuariosRepo } = crearServicioConMocks(null);
    await service.crearUsuario({
      usuario: 'admin2', contrasena: 'x', nombreParaMostrar: 'Admin2', alcance: 'todos', perfilId: 'perfil_admin', esSuperadmin: true,
    });
    expect(usuariosRepo.create).toHaveBeenCalledWith(expect.objectContaining({ perfilId: null, esSuperadmin: true }));
  });
});
