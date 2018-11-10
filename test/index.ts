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
      routes.action('GET', 'home', root => {
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
    const actions = router.actions;
    // console.log('actions', actions);
    expect(actions['home'].action.action).to.equal('getHome');

    expect(actions['users[user].show'].action.controller.show).to.equal('yes');
    expect(actions['users[user].update'].action.controller.show).to.equal('no');

    expect(actions['users[user].show'].action.auth).to.equal(undefined);
    expect(actions['users[user].update'].action.auth).to.equal('admin');

    expect(actions['users.create'].action.validate.payload).to.equal(userSchema);
  });
});
