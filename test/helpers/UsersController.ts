import Hapi from 'hapi';
import Joi from 'joi';

const users = [
  {
    id: 1,
    first_name: 'Arthas',
    last_name: 'Menethil'
  },
  {
    id: 2,
    first_name: 'Jaina',
    last_name: 'Proudmoore'
  },
  {
    id: 3,
    first_name: 'Thrall',
    last_name: 'Son of Durotan'
  },
];

const UsersController = {
  schema: Joi.object({
    first_name: Joi.string(),
    last_name: Joi.string(),
  }),
  async index(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    return users;
  },
  async show(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId
      }
    } = request;
    const user = users.find(user => String(user.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    return user;
  },
  async create(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      payload
    } = request;
    const user = { ...(payload as object), id: 4 };
    return user;
  },
  async update(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId
      },
      payload
    } = request;
    const user = users.find(user => String(user.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    Object.assign(user, payload);
    return user;
  },
  async destroy(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    const {
      params: {
        user: userId
      }
    } = request;
    const user = users.find(user => String(user.id) === userId);
    if (!user) {
      return h.response().code(404);
    }
    return users.filter(user => String(user.id) !== userId);
  },
};

export default UsersController;