# hapi-resource-router

## Install

```
npm install hapi-resource-router
```

## Overview

```
routes.collection('users', users => {
  users.controller = UserController;
  users.auth = 'token';
  users.create(create => {
    create.validate.payload = UserController.schema.create;
  }); // POST /users
  users.index(); // GET /users
  users.items('user', user => {
    user.preloads.push({ param: 'user', model: User, key: 'id' });
    user.show(); // GET /users/{user}
    user.update(); // PUT /users/{user}
    user.destroy(); // DELETE /users/{user}
    user.post('refresh'); // POST /users/{user}/refresh
  });
});

export default routes;
```

## Steps

- Preload
- Authorize
