const { expect } = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const { describe, it, before } = lab;
const Joi =  require('joi');

const { ResourceRouter } = require('../lib');

describe('ResourceRouter', () => {
  it('builds routes', () => {
    const userSchema = Joi.object({
      first_name: Joi.string(),
      last_name: Joi.string(),
    });

    const router = new ResourceRouter({});
    router.add((routes) => {
      routes.controller = { show: () => 'no' };
      routes.route('GET', 'home', root => {
        root.action = 'getHome';
      });
      routes.collection('users', users => {
        users.validate.payload = userSchema;
        users.index();
        users.create();
        users.items('user', user => {
          user.show(show => {
            show.controller = { show: () => 'yes' };
          });
          user.group('admin', admin => {
            admin.auth = 'admin';
            admin.update();
            admin.destroy();
          });
        });
      });
    });
    const routes = router.routes;
    // console.log('routes', routes);
    expect(routes['home'].route.action).to.equal('getHome');

    expect(routes['users[user].show'].route.controller.show({}, {})).to.equal('yes');
    expect(routes['users[user].update'].route.controller.show({}, {})).to.equal('no');

    expect(routes['users[user].show'].route.auth).to.equal(undefined);
    expect(routes['users[user].update'].route.auth).to.equal('admin');

    expect(routes['users.create'].route.validate.payload).to.equal(userSchema);
  });
  it('generates URLs using href()', () => {
    const router = new ResourceRouter({
      baseUrl: 'https://api.example.com',
      basePath: '/v1',
    });
    router.add((routes) => {
      routes.controller = { show: () => 'no' };
      routes.route('GET', 'home', root => {
        root.action = 'getHome';
      });
      routes.collection('users', users => {
        users.index();
        users.create();
        users.items('user', user => {
          user.show(show => {
            show.controller = { show: () => 'yes' };
          });
          user.group('admin', admin => {
            admin.auth = 'admin';
            admin.update();
            admin.destroy();
          });
        });
      });
    });

    const url = router.href('users[user].show', { user: 1 });
    expect(url).to.equal('https://api.example.com/v1/users/1');
  });
});
