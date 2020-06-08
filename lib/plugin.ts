import Hapi, { Plugin } from '@hapi/hapi';
import ResourceRouter, { Route, SubscriptionRoute, ResourceRouterOptions } from './resource_router';
// @ts-ignore
import packageJson from '../package.json';
import { Controller, ControllerClass } from './controller';

declare module '@hapi/hapi' {
  export interface Server {
    resources: () => ResourceRouter;
  }
  export interface PluginSpecificConfiguration {
    resourceRouter?: {
      controller?: any;
    };
  }

  export interface PluginProperties {
    resourceRouter?: {
      resolveController?: (name: string) => Controller;
    };
  }
}

export type ControllerMap = {
  [name: string]: Controller|ControllerClass;
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

  controllerMap?: ControllerMap;

  constructor(options: PluginOptions) {
    this.options = options;
  }

  resolveController(name: string, ...args: any[]) {
    if (!(this.controllerMap && this.controllerMap[name])) {
      throw new Error(`Missing controller ${name}`);
    }

    const controller = this.controllerMap[name];
    if (typeof controller === 'function') {
      const ControllerSubclass = controller;
      return new ControllerSubclass(...args);
    }
    return controller;
  }

  resolveControllerForRoute(route: Route) {
    if (Array.isArray(route.controller)) {
      return this.resolveController(route.controller[0], ...route.controller.slice(1));
    }
    if (typeof route.controller === 'string') {
      return this.resolveController(route.controller);
    }
    return route.controller!;
  }

  static getHandler(route: Route, controller: Controller) {
    if (typeof route.action === 'string') {
      if (!(route.controller && controller[route.action])) {
        return null;
      }
      return controller[route.action].bind(controller);
    }
    return route.action;
  }

  static getSubscriptionHandler(
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

  static resolveControllerValidator(
    route: Route,
    controller: Controller,
    key: 'params'|'query'|'response'|'payload',
  ) {
    if (key === 'payload' && Internals.skipPayloadValidation(route)) {
      return undefined;
    }

    // tslint:disable-next-line: max-line-length
    const validateKey = `validate${key.substring(0, 1).toUpperCase()}${key.substring(1)}` as keyof Route['options'];
    if (route.options[validateKey]) {
      return route.options[validateKey];
    }

    if (typeof route.action !== 'string') {
      return undefined;
    }

    if (!controller) {
      return undefined;
    }

    let validator = controller.validate;
    if (!validator && controller.constructor && 'validate' in controller.constructor) {
      validator = controller.constructor.validate;
    }

    if (!validator) {
      return undefined;
    }

    const validationEntry = validator[key];
    if (!validationEntry) {
      return undefined;
    }

    let validate;
    if (typeof validationEntry === 'function') {
      validate = validationEntry.apply(validator, [route.action]);
    } else {
      validate = validationEntry[route.action];
    }
    return validate;
  }

  static buildValidate(route: Route, controller: Controller) {
    return {
      params: Internals.resolveControllerValidator(
        route,
        controller,
        'params',
      ),
      query: Internals.resolveControllerValidator(
        route,
        controller,
        'query',
      ),
      response: Internals.resolveControllerValidator(
        route,
        controller,
        'response',
      ),
      payload: Internals.resolveControllerValidator(
        route,
        controller,
        'payload',
      ),
    };
  }

  static skipPayloadValidation(route: Route) {
    return skipPayloadValidationMethods.has(route.method);
  }

  async onPostStart(server: Hapi.Server) {
    const { routes } = server.resources();

    if (this.options.controllers) {
      if (typeof this.options.controllers === 'function') {
        this.controllerMap = await this.options.controllers();
      } else {
        this.controllerMap = this.options.controllers;
      }
    }

    for (const name of Object.keys(routes)) {
      const { path, route } = routes[name];

      const controller = this.resolveControllerForRoute(route);

      if (isSubscription(route)) {
        const subscribableServer: Hapi.Server|Subscribable = server;
        if (isSubscribable(subscribableServer)) {
          subscribableServer.subscription(
            path,
            {
              ...route.config,
              filter: Internals.getSubscriptionHandler(route, controller, 'filter'),
              onSubscribe: Internals.getSubscriptionHandler(route, controller, 'onSubscribe'),
              onUnsubscribe: Internals.getSubscriptionHandler(route, controller, 'onUnsubscribe'),
            },
          );
        }
        continue;
      }

      server.route({
        path,
        method: route.method,
        handler: Internals.getHandler(route, controller),
        options: {
          id: name,
          description: route.description,
          notes: route.notes,
          auth: route.auth,
          tags: route.tags.all(),
          pre: route.pre.all(),
          payload: route.payload,
          validate: Internals.buildValidate(route, controller),
          plugins: {
            ...route.plugins,
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
    server.expose('resolveController', internals.resolveController.bind(internals));

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
