const { expect } = require('@hapi/code');
const Lab = require('@hapi/lab');

const lab = Lab.script();
const { describe, it, before } = lab;
const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

const Plugin = require('../lib').default;
const resources = require('./helpers/resources').default;

exports.lab = lab;

const isValidationError = (err) => err.isJoi && err.name === 'ValidationError';

class Controller {
  constructor(res, action = 'submit') {
    this[action] = () => res;
  }
}

describe('Plugin', () => {
  it('registers', async () => {
    const server = new Hapi.Server();
    await server.register({
      plugin: Plugin,
      options: {
        basePath: '/api',
      },
    });
    server.resources().add(resources);
    await server.start();

    const response = await server.inject({
      method: 'GET',
      url: '/api',
    });
    expect(JSON.parse(response.payload)).to.equal({
      hello: 'world',
    });

    const response2 = await server.inject({
      method: 'GET',
      url: '/api/banana',
    });
    expect(response2.payload).to.equal('banana!');

    const response3 = await server.inject({
      method: 'DELETE',
      url: '/api/users/1',
    });
    const users = JSON.parse(response3.payload);
    const userIds = users.map(user => user.id);
    expect(userIds).to.not.contain(1);
  });

  describe('controllers', () => {
    let server;
    before(async () => {
      server = new Hapi.Server();
      await server.register({ plugin: Plugin, options: {} });
      server.resources().add((routes) => {
        routes.controller = new Controller('hey!');

        routes.route('POST', 'submit');
      });
      await server.start();
    });
    it('is bound as "this" to the handler functions', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {},
      });
      expect(response.statusCode).to.equal(200);
      expect(response.payload).to.equal('hey!');
    });
  });

  describe('validation', () => {
    let server;
    before(async () => {
      server = new Hapi.Server({
        routes: {
          validate: {
            async failAction(request, h, err) {
              if (isValidationError(err)) {
                const badData = Boom.badData('Validation error');
                badData.output.payload.details = err.details;
                throw badData;
              } else {
                throw Boom.badImplementation();
              }
            },
          },
        },
      });
      await server.register({ plugin: Plugin, options: {} });
      server.resources().add((routes) => {
        routes.controller = {
          submit(request) {
            return request.payload.banana;
          },
          square(request) {
            return request.payload.banana ** 2;
          },
          validate: {
            payload: {
              submit: Joi.object({
                banana: Joi.string().required().min(3),
              }),
              square: Joi.object({
                banana: Joi.number().required().min(10),
              }),
            },
          },
        };

        routes.route('POST', 'submit');
        routes.route('POST', 'square', square => {
          square.validate.payload = Joi.object({
            banana: Joi.number().required().max(5),
          });
        });

        routes.namespace('example', example => {
          class V {
            constructor(field) {
              this.field = field;
            }

            payload() {
              return Joi.object({
                [this.field]: Joi.string().required(),
              });
            }

            // eslint-disable-next-line class-methods-use-this
            query() {
              return Joi.object({
                refresh: Joi.boolean().optional().default(false),
              });
            }
          }

          example.controller = {
            act({ payload: { friend }, query: { refresh } }) {
              return { friend, refresh };
            },
            validate: new V('friend'),
          };
          example.route('PUT', 'act');
        });

        routes.collection('instances', instances => {
          class InstancesController {
            constructor(val) {
              this.val = val;
            }

            index(request, h) {
              const result = this.val[request.query.q];
              if (!result) {
                return h.response().code(404);
              }
              return result;
            }
          }
          InstancesController.validate = {
            query: {
              index: Joi.object({
                q: Joi.string().required(),
              }),
            },
          };

          instances.controller = new InstancesController({
            banana: 'HI',
          });
          instances.index();
        });
      });

      await server.start();
    });

    it('fails when field not present', async () => {
      const notPresentResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {},
      });
      expect(notPresentResponse.statusCode).to.equal(422);
      const error = notPresentResponse.result.details[0];
      expect(error.path).to.equal(['banana']);
      expect(error.type).to.equal('any.required');
    });

    it('fails when field is too short', async () => {
      const tooShortResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {
          banana: 'A',
        },
      });
      expect(tooShortResponse.statusCode).to.equal(422);
    });

    it('succeeds when the field is valid', async () => {
      const justRightResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {
          banana: 'yay!',
        },
      });
      expect(justRightResponse.statusCode).to.equal(200);
      expect(justRightResponse.payload).to.equal('yay!');
    });

    it('fails when an unexpected field is present', async () => {
      const tooManyResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {
          banana: 'yay!',
          notBanana: 'what',
        },
      });
      expect(tooManyResponse.statusCode).to.equal(422);
    });

    it('prefers the route\'s validation over the controller\'s', async () => {
      const squareResponse = await server.inject({
        method: 'POST',
        url: '/square',
        payload: {
          banana: 3,
        },
      });
      expect(squareResponse.statusCode).to.equal(200);
      expect(squareResponse.result).to.equal(9);
    });

    it('retains the "this" on the validator functions', async () => {
      const squareResponse = await server.inject({
        method: 'PUT',
        url: '/example/act?refresh=true',
        payload: {
          friend: 'matt',
        },
      });
      expect(squareResponse.statusCode).to.equal(200);
      expect(squareResponse.result).to.equal({
        friend: 'matt',
        refresh: true,
      });
    });

    it('uses the static validate on controller instances', async () => {
      const invalidResponse = await server.inject({
        method: 'GET',
        url: '/instances',
      });
      expect(invalidResponse.statusCode).to.equal(422);

      const validResponse = await server.inject({
        method: 'GET',
        url: '/instances?q=banana',
      });
      expect(validResponse.result).to.equal('HI');
    });
  });

  describe('controllers', () => {
    it('accepts a map of controllers', async () => {
      const server = new Hapi.Server();
      await server.register({
        plugin: Plugin,
        options: {
          basePath: '/api',
          controllers: {
            home: new Controller('home!', 'home'),
            banana: new Controller('banana!', 'banana'),
          },
        },
      });
      server.resources().add((routes) => {
        routes.route('GET', 'home', home => {
          home.controller = 'home';
        });
        routes.route('GET', 'banana', banana => {
          banana.controller = 'banana';
        });
      });
      await server.start();

      const homeResponse = await server.inject({
        method: 'GET',
        url: '/api/home',
      });
      expect(homeResponse.payload).to.equal('home!');

      const bananaResponse = await server.inject({
        method: 'GET',
        url: '/api/banana',
      });
      expect(bananaResponse.payload).to.equal('banana!');
    });

    it('accepts a promise for a map of controllers', async () => {
      class BananaController {
        constructor(numero) {
          this.numero = numero;
        }

        banana() {
          return { numero: this.numero };
        }
      }

      const server = new Hapi.Server();
      await server.register({
        plugin: Plugin,
        options: {
          basePath: '/api',
          async controllers() {
            return {
              home: new Controller('home!', 'home'),
              banana: BananaController,
            };
          },
        },
      });
      server.resources().add((routes) => {
        routes.route('GET', 'home', home => {
          home.controller = 'home';
        });
        routes.route('GET', 'banana', banana => {
          banana.controller = ['banana', 500];
        });
      });
      await server.start();

      const homeResponse = await server.inject({
        method: 'GET',
        url: '/api/home',
      });
      expect(homeResponse.payload).to.equal('home!');

      const bananaResponse = await server.inject({
        method: 'GET',
        url: '/api/banana',
      });
      expect(JSON.parse(bananaResponse.payload)).to.equal({ numero: 500 });
    });
  });
});
