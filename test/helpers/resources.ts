import { ResourceRouter } from '../../lib';

import HomeController from './HomeController';
import UsersController from './UsersController';

export default (routes: ResourceRouter) => {
  routes.controller = HomeController;
  routes.rootRoute('GET', 'home');
  routes.route('GET', 'banana', banana => {
    banana.action = 'getBanana';
  });
  routes.collection('users', users => {
    users.controller = UsersController;
    users.validate.payload = UsersController.schema;
    users.index();
    users.create();
    users.items('user', user => {
      user.show(show => {
        show.controller = { show: () => 'yes' };
      });
      user.group('admin', admin => {
        admin.update();
        admin.destroy(destroy => {
          destroy.validate.payload = undefined;
        });
      });
    });
  });
};
