import Hapi, { Plugin } from 'hapi';
import ResourceRouter, { Route, SubscriptionRoute, ResourceRouterOptions } from './resource_router';
// @ts-ignore
import packageJson from '../package.json';
import { Controller } from 'controller';

declare module 'hapi' {
  export interface Server {
    resources: () => ResourceRouter;
  }
  export interface PluginSpecificConfiguration {
    resourceRouter?: {
      controller?: any;
    };
  }
}

export type ControllerMap = {
  [name: string]: Controller;
};

export type ControllerResolver = () => Promise<ControllerMap>;

export interface PluginOptions extends ResourceRouterOptions {
  controllers: ControllerMap | ControllerResolver;
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

class Internals {
  options: PluginOptions;
  constructor(options: PluginOptions) {
    this.options = options;
  }
  resolveController(controllers: undefined|ControllerMap, route: Route) {
    if (typeof route.controller === 'string') {
      if (!(controllers && controllers[route.controller])) {
        throw new Error(`Missing controller for ${route.name}: ${route.controller}`);
      }
      return controllers[route.controller];
    }
    return route.controller!;
  }
  getHandler(route: Route, controller: Controller) {
    if (typeof route.action === 'string') {
      if (!(route.controller && controller[route.action])) {
        return null;
      }
      return controller[route.action].bind(route.controller);
    }
    return route.action;
  }
  getSubscriptionHandler(
    route: SubscriptionRoute,
    controller: Controller,
    name: 'filter'|'onSubscribe'|'onUnsubscribe',
  ): Function|undefined {
    const config = route.config[name];
    if (typeof config === 'string') {
      if (!(route.controller && controller[config])) {
        return undefined;
      }
      return controller[config];
    }
    return config;
  }
  resolveControllerValidator(
    route: Route,
    controller: Controller,
    key: 'params'|'query'|'response'|'payload',
    fallback?: any,
  ) {
    if (key === 'payload' && this.skipPayloadValidation(route)) {
      return;
    }

    if (typeof route.action !== 'string') {
      return fallback;
    }

    if (!controller) {
      return fallback;
    }

    let validator = controller.validate;
    if (!validator && controller.constructor && 'validate' in controller.constructor) {
      validator = controller.constructor.validate;
    }

    if (!validator) {
      return fallback;
    }

    const validationEntry = validator[key];
    if (!validationEntry) {
      return fallback;
    }

    let validate;
    if (typeof validationEntry === 'function') {
      validate = validationEntry.apply(validator, [route.action]);
    } else {
      validate = validationEntry[route.action];
    }
    if (validate) {
      return validate;
    }
    return fallback;
  }
  buildValidate(route: Route, controller: Controller) {
    return {
      params: this.resolveControllerValidator(
        route,
        controller,
        'params',
        route.options.validateParams,
      ),
      query: this.resolveControllerValidator(
        route,
        controller,
        'query',
        route.options.validateQuery,
      ),
      response: this.resolveControllerValidator(
        route,
        controller,
        'response',
        route.options.validateResponse,
      ),
      payload: this.resolveControllerValidator(
        route,
        controller,
        'payload',
        route.options.validatePayload,
      ),
    };
  }
  skipPayloadValidation(route: Route) {
    return skipPayloadValidationMethods.has(route.method);
  }
  async onPostStart(server: Hapi.Server) {
    const routes = server.resources().routes;

    let controllers;
    if (this.options.controllers) {
      if (typeof this.options.controllers === 'function') {
        controllers = await this.options.controllers();
      } else {
        controllers = this.options.controllers;
      }
    }

    for (const name of Object.keys(routes)) {
      const { path, route } = routes[name];

      const controller = this.resolveController(controllers, route);

      if (isSubscription(route)) {
        const subscribableServer: Hapi.Server|Subscribable = server;
        if (isSubscribable(subscribableServer)) {
          subscribableServer.subscription(
            path,
            {
              filter: this.getSubscriptionHandler(route, controller, 'filter'),
              onSubscribe: this.getSubscriptionHandler(route, controller, 'onSubscribe'),
              onUnsubscribe: this.getSubscriptionHandler(route, controller, 'onUnsubscribe'),
              auth: route.config.auth,
            },
          );
        }
        continue;
      }

      server.route({
        path,
        method: route.method,
        handler: this.getHandler(route, controller),
        options: {
          id: name,
          description: route.description,
          notes: route.notes,
          auth: route.auth,
          tags: route.tags.all(),
          pre: route.pre.all(),
          payload: route.payload,
          validate: this.buildValidate(route, controller),
          plugins: {
            resourceRouter: {
              controller,
            },
          },
        },
      });
    }
  }
}

const plugin: Hapi.Plugin<PluginOptions> = {
  register(server: Hapi.Server, options: PluginOptions) {
    const internals = new Internals(options);
    const router = new ResourceRouter(options);
    server.decorate('server', 'resources', () => router);

    server.ext({
      type: 'onPostStart',
      method: internals.onPostStart.bind(internals),
    });
  },
  pkg: {
    name: 'resourceRouter',
    version: packageJson.version,
  },
};

export default plugin;