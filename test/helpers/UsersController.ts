import Hapi from '@hapi/hapi';
import Joi from '@hapi/joi';

const users = [
  {
    id: 1,
    first_name: 'Arthas',
    last_name: 'Menethil',
  },
  {
    id: 2,
    first_name: 'Jaina',
    last_name: 'Proudmoore',
  },
  {
    id: 3,
    first_name: 'Thrall',
    last_name: 'Son of Durotan',
  },
];

const UsersController = {
  schema: Joi.object({
    first_name: Joi.string(),
    last_name: Joi.string(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async index(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    return users;
  },
  async show(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId,
      },
    } = request;
    const user = users.find(u => String(u.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    return user;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      payload,
    } = request;
    const user = { ...(payload as object), id: 4 };
    return user;
  },
  async update(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId,
      },
      payload,
    } = request;
    const user = users.find(u => String(u.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    Object.assign(user, payload);
    return user;
  },
  async destroy(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId,
      },
    } = request;
    const user = users.find(u => String(u.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    return users.filter(u => String(u.id) !== userId);
  },
};

export default UsersController;
