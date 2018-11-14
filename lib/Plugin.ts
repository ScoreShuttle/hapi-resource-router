import Hapi from 'hapi';
import ResourceRouter, { Route, SubscriptionRoute, ResourceRouterOptions } from './ResourceRouter';
// @ts-ignore
import packageJson from '../package.json';

declare module 'hapi' {
  export interface Server {
    resources: () => ResourceRouter;
  }
}

const skipPayloadValidationMethods = new Set([
  'GET',
  'OPTIONS',
]);

interface Subscribable {
  subscription: (path: string, options: any) => any;
}

function isSubscribable(server: any): server is Subscribable {
  return server.subscription !== undefined;
}

function isSubscription(route: Route): route is SubscriptionRoute {
  return route.method === 'SUBSCRIPTION';
}

const internals = {
  getHandler(route: Route) {
    if (typeof route.action === 'string') {
      if (!(route.controller && route.controller[route.action])) {
        return undefined;
      }
      return route.controller[route.action];
    }
    return route.action;
  },
  getSubscriptionHandler(
    route: SubscriptionRoute,
    name: 'filter'|'onSubscribe'|'onUnsubscribe',
  ): Function|undefined {
    const config = route.config[name];
    if (typeof config === 'string') {
      if (!(route.controller && route.controller[config])) {
        return undefined;
      }
      return route.controller[config];
    }
    return config;
  },
  buildValidate(route: Route) {
    return {
      params: route.options.validateParams,
      query: route.options.validateQuery,
      response: route.options.validateResponse,
      payload:
        this.skipPayloadValidation(route)
          ? undefined
          : route.options.validatePayload,
    };
  },
  skipPayloadValidation(route: Route) {
    return skipPayloadValidationMethods.has(route.method);
  },
  async onPostStart(server: Hapi.Server) {

    const routes = server.resources().routes;

    for (const name of Object.keys(routes)) {
      const { path, route } = routes[name];

      if (isSubscription(route)) {
        const subscribableServer: Hapi.Server|Subscribable = server;
        if (isSubscribable(subscribableServer)) {
          subscribableServer.subscription(
            path,
            {
              filter: internals.getSubscriptionHandler(route, 'filter'),
              onSubscribe: internals.getSubscriptionHandler(route, 'onSubscribe'),
              onUnsubscribe: internals.getSubscriptionHandler(route, 'onUnsubscribe'),
              auth: route.config.auth,
            },
          );
        }
        continue;
      }

      server.route({
        path,
        method: route.method,
        handler: internals.getHandler(route),
        options: {
          id: name,
          description: route.description,
          notes: route.notes,
          auth: route.auth,
          tags: route.tags.all(),
          pre: route.pre.all(),
          payload: route.payload,
          validate: internals.buildValidate(route),
        },
      });
    }
  },
};

const plugin: Hapi.Plugin<ResourceRouterOptions> = {
  register(server: Hapi.Server, options: ResourceRouterOptions) {
    const router = new ResourceRouter(options);
    server.decorate('server', 'resources', () => router);

    server.ext({
      type: 'onPostStart',
      method: internals.onPostStart,
    });
  },
  pkg: {
    name: 'resourceRouter',
    version: packageJson.version,
  },
};

export default plugin;
