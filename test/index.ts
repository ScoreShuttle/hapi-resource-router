import { expect } from 'code';
import Lab from 'lab';
export const lab = Lab.script();
const { describe, it } = lab;
import Joi from 'joi';

import ResourceRouter from '../lib';

describe('ResourceRouter', () => {
  it('builds routes', () => {
    const userSchema = Joi.object({
      first_name: Joi.string(),
      last_name: Joi.string(),
    });

    const router = ResourceRouter.create({}, (routes) => {
      routes.controller = { show: 'no' };
      routes.route('GET', 'home', root => {
        root.action = 'getHome';
      });
      routes.collection('users', users => {
        users.validate.payload = userSchema;
        users.index();
        users.create();
        users.items('user', user => {
          user.show(show => {
            show.controller = { show: 'yes' };
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

    expect(routes['users[user].show'].route.controller.show).to.equal('yes');
    expect(routes['users[user].update'].route.controller.show).to.equal('no');

    expect(routes['users[user].show'].route.auth).to.equal(undefined);
    expect(routes['users[user].update'].route.auth).to.equal('admin');

    expect(routes['users.create'].route.validate.payload).to.equal(userSchema);
  });
});
