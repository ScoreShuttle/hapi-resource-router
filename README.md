# hapi-resource-router

## Install

```
npm install hapi-resource-router
```

## Overview

Register the plugin in hapi:

```
await server.register({
  plugin: require('hapi-resource-router'),
  options: {
    baseUrl: '/v1'
  }
});
```

Define a `routes.ts` module:
```
import { ResourceRouter } from 'hapi-resource-router';

export default (routes: ResourceRouter) => {
  routes.collection('users', users => {
    users.controller = UserController;
    users.auth = 'jwt:user';
    users.create(create => {
      create.validate.payload = UserController.schema.create;
    }); // POST /v1/users
    users.index(); // GET /v1/users
    users.items('user', user => {
      user.show(); // GET /v1/users/{user}
      user.update(); // PUT /v1/users/{user}
      user.destroy(); // DELETE /v1/users/{user}
      user.route('POST', 'refresh'); // POST /v1/users/{user}/refresh
    });
  });
};
```

Then add your routes to the resource router:
```
import routes from './routes';

...

server.resources().add(routes);
```

### Prerequisites
