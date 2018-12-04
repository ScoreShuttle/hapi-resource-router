const { expect } = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const { describe, it, before } = lab;
const Hapi = require('hapi');
const Joi =  require('joi');
const Boom = require('boom');

const Plugin = require('../lib').default;
const resources = require('./helpers/resources').default;

const isValidationError = (err) => {
  return err.isJoi && err.name === 'ValidationError';
}

describe('Plugin', () => {
  it('registers', async () => {

    const server = new Hapi.Server();
    await server.register({ plugin: Plugin, options: {
      basePath: '/api'
    } });
    server.resources().add(resources);
    await server.start();

    const response = await server.inject({
      method: 'GET',
      url: '/api'
    });
    expect(JSON.parse(response.payload)).to.equal({
      hello: 'world'
    });

    const response2 = await server.inject({
      method: 'GET',
      url: '/api/banana'
    });
    expect(response2.payload).to.equal('banana!');

    const response3 = await server.inject({
      method: 'DELETE',
      url: '/api/users/1'
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
        class Controller {
          constructor(res) {
            this.responder = res;
          }
          submit(request) {
            return this.responder;
          }
        }
        routes.controller = new Controller('hey!');

        routes.route('POST', 'submit');
      });
      await server.start();
    });
    it('is bound as "this" to the handler functions', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {}
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
                const badData =  Boom.badData('Validation error');
                badData.output.payload.details = err.details;
                throw badData;
              } else {
                throw Boom.badImplementation();
              }
            }
          }
        }
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
                banana: Joi.string().required().min(3)
              }),
              square: {
                banana: Joi.number().required().min(3)
              }
            }
          }
        };

        routes.route('POST', 'submit');
        routes.route('POST', 'square', square => {
          square.validate.payload = {
            banana: Joi.number().required().max(0)
          };
        });

        routes.namespace('example', example => {
          class V {
            constructor(field) {
              this.field = field;
            }
            payload(action) {
              return Joi.object({
                [this.field]: Joi.string().required()
              });
            }
            query(action) {
              return Joi.object({
                refresh: Joi.boolean().optional().default(false)
              });
            }
          }

          example.controller = {
            act({ payload: { friend }, query: { refresh } }) {
              return { friend, refresh };
            },
            validate: new V('friend')
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
              index: {
                q: Joi.string().required()
              }
            }
          };
          
          instances.controller = new InstancesController({
            banana: 'HI'
          });
          instances.index();
        });
      });

      await server.start();
    })

    it('fails when field not present', async () => {
      const notPresentResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {}
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
          banana: 'A'
        }
      });
      expect(tooShortResponse.statusCode).to.equal(422);
    });

    it('succeeds when the field is valid', async () => {
      const justRightResponse = await server.inject({
        method: 'POST',
        url: '/submit',
        payload: {
          banana: 'yay!'
        }
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
          notBanana: 'what'
        }
      });
      expect(tooManyResponse.statusCode).to.equal(422);
    });

    it('prefers the controller\'s validation over the route\'s', async () => {
      const squareResponse = await server.inject({
        method: 'POST',
        url: '/square',
        payload: {
          banana: 20
        }
      });
      expect(squareResponse.statusCode).to.equal(200);
      expect(squareResponse.result).to.equal(400);
    });

    it('retains the "this" on the validator functions', async () => {
      const squareResponse = await server.inject({
        method: 'PUT',
        url: '/example/act?refresh=true',
        payload: {
          friend: 'matt'
        }
      });
      expect(squareResponse.statusCode).to.equal(200);
      expect(squareResponse.result).to.equal({
        friend: 'matt',
        refresh: true
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
  })
});
