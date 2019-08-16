**hapi-resource-router** adds a resourceful router to [hapi](https://github.com/hapijs/hapi)-based application servers.  Instead of defining and configuring routes on an individual basis, **hapi-resource-router** uses a hierarchy of *resources* under which the routes are defined to allow configuration to be shared and inherited in a more imperative way. 

Lead Maintainer - [Chris Serino](https://github.com/themindoverall)

- [Install](#install)
- [API](#api)
- [Example](#example)

## Install

```
npm install hapi-resource-router
```

## API

The API is available in the [API documentation](https://github.com/LibreTechnologyInc/hapi-resource-router/blob/master/API.md).

## Example

### Server

```js
const Hapi = require('@hapi/hapi');
const HapiResourceRouter = require('hapi-resource-router');
const resources = require('./resources');

const server = new Hapi.Server();
const start = async () => {
  await server.register({
    plugin: HapiResourceRouter.default,
    options: {
      basePath: '/v1'
    }
  });
  server.resources().add(resources);

  await server.start();
};

start();
```

### Resources

```js
const UserController = require('./user_controller');

module.exports = (routes) => {
  routes.collection('users', users => {
    users.controller = UserController;
    users.index(); // GET /v1/users
    users.create(); // POST /v1/users
    users.items('user', user => {
      user.show(); // GET /v1/users/{user}
      user.update(); // PUT /v1/users/{user}
      user.destroy(); // DELETE /v1/users/{user}
    });
  });
};
```

### Controller

```js
const Joi = require('@hapi/joi');

const users = [
  {
    username: 'chris'
  },
  {
    username: 'matt'
  }
];

class UserController {
  index(request, h) {
    return users;
  }
  show(request, h) {
    const username = request.params.user;
    const user = users.find((u) => u.username === username);
    if (!user) {
      return h.response('Not found').statusCode(404);
    }
    return user;
  }
  create(request, h) {
    const user = request.payload;
    return user;
  }
  update(request, h) {
    const username = request.params.user;
    const user = users.find((u) => u.username === username);
    if (!user) {
      return h.response('Not found').statusCode(404);
    }
    Object.assign(user, request.payload);
    return user;
  }
  destroy(request, h) {
    const username = request.params.user;
    const user = users.find((u) => u.username === username);
    if (!user) {
      return h.response('Not found').statusCode(404);
    }
    return h.response();
  }
}

UserController.validate = {
  payload: {
    create: Joi.object({
      username: Joi.string().email().required(),
      password: Joi.string().required()
    }),
    update: Joi.object({
      password: Joi.string().required()
    })
  }
};

module.exports = new UserController();
```
