# 1.2.x API Reference

## Registration

### Options

- `basePath` - provide a prefix for all route paths
- `baseUrl` - when generating URLs using `href()`, it will use this URL

## Server

### `server.resources()`

When the plugin is registered, `server` is decorated with the `resources()` object.

#### `server.resources().add(build)`

Takes a callback function `build` with the signature `function(builder)` where `builder` is a **ResourceBuilder** object.

#### `server.resources().href(name, params)`

Builds a canonical URL by finding the route with the full name `name` and filling in any **Collection Items** with a given value.

Example:
```js
await server.register({
  plugin: HapiResourceRouter,
  options: {
    baseUrl: 'https://localhost:3000'
  }
});

server.resources().add((routes) => {
  routes.namespace('test', test => {
    // everything defined under this function will have a name prefixed with "test"
    test.collection('examples', examples => {
      // everything defined under this function will have a name prefixed with "test.examples"
      examples.items('example', example => {
        // everything defined under this function will have a name prefixed with "test.examples[example]"
        example.show(); // has the full name "test.examples[example].show" and the full route would be GET /test/examples/{example}
      });
    });
  });
})

server.resources().href('test.examples[example].show', { example: '100' }) === 'https://localhost:3000/test/examples/100'
```

## ResourceBuilder

- `route(method, name, [builder])` - add a **Route Resource**
 - `method` - `GET`,`POST`,`PUT`,`PATCH`,`DELETE`
 - `name` - the name of the route resource to create
- `collection(name, [builder])` - add a **Collection Resource**
- `item(name, [builder])` - add an **Item Resource**
- `namespace(name, [builder])` - add a **Namespace Resource**
- `controller` - inherited
- `validate` - inherited
- `auth` - inherited
- `pre` - inherited array
- `tags` - inherited array

### Inherited Values

When defining a resource, some of its properties will be inherited from its parent resource.  This lets you define it once and have it carry across to many routes.  For example, if you set the "auth" property on a **Collection Resource** to "basic", then every route and subresource under it will also have the "basic" auth set.

This works by using the prototype inheritence feature in JavaScript -- each resource's `options`'s prototype is set to its parent's `options` property. So you can set values to `controller`, `auth`, etc without affecting the resource's parent value.

The `pre` and `tags` properties work a bit differently as they are inherited arrays.  Rather than using a prototypical hierarchy, inherited arrays store their values and a reference to their parent so logically they work similar to the other inherited properties in that they have their parent's value by default and when you modify their values they don't change their parents.

#### InheritedArray

- `push(value)` - push a value onto the array
- `clear()` - remove all values in this array *including inherited entries*
- `all()` - returns the full array including inherited entries

#### Example

```js
server.resources().add((routes) => {
  routes.namespace('admin', admin => {
    admin.auth = 'admin'; // everything in this namespace will have auth: 'admin'
    admin.tags.push('admin');
    admin.collection('users', users => {
      users.controller = UsersController; // everything in this collection will use UsersController
      users.index();
      users.create(create => {
        create.auth = false; // disable auth so anyone can create a user
        create.tags.clear(); // remove inherited values
        create.tags.push('registration'); // add "registration" tag
      });
    })
  });
})
```

### Collections

Collections have the same methods as **ResourceBuilder** as well as:

- `index([builder])` - creates a GET route with name "index"
- `create([builder])` - creates a POST route with name "create"
- `update([builder])` - creates a PUT route with name "update"
- `patch([builder])` - creates a PATCH route with name "patch"
- `destroy([builder])` - creates a DELETE route with name "destroy"
- `items(name, [builder])` - creates a special **Item Resource** with a special name (`collection name[item name]`) and the path uses the name as a param name (`/collection path/{item name}`)

### Items

- `show([builder])` - creates a GET route with name "show"
- `create([builder])` - creates a POST route with name "create"
- `update([builder])` - creates a PUT route with name "update"
- `patch([builder])` - creates a PATCH route with name "patch"
- `destroy([builder])` - creates a DELETE route with name "destroy"

### Namespaces

### Groups

Groups work like namespaces (or any other resource) except they have the same path as their parent -- so you can group routes/collections together with similar options without needing to affect their paths.

### Routes

Routes have the same properties as routes in **hapi**, except for the handler (which is taken from the `controller` and `action` properties)