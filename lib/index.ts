import { JoiObject } from "joi";

export interface ResourceOptions {
  auth?: string|object;
  controller?: any;
  validatePayload?: JoiObject;
  validateParams?: JoiObject;
  validateQuery?: JoiObject;
  tags?: [string];
}

interface Validations {
  payload?: JoiObject;
  params?: JoiObject;
  query?: JoiObject;
}

const ROOT = Symbol('ROOT');
type ROOT = typeof ROOT;

export type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE';
type Path = string|ROOT;

type RouteBuilder = (route: Route) => void;

type ResourceChildren = Map<string,ResourceNode>;
type ResourceBuilder<T extends Resource> = (resource: T) => void;
type ResourceNodeVisitor = (name: string, path: string, route: Route) => boolean;

class ResourceNode {
  options: ResourceOptions;
  name: string;
  path: Path;
  constructor(name: string, path: Path, options: ResourceOptions|null = null) {
    this.name = name;
    this.path = path;
    this.options = Object.create(options);
  }
  get auth() {
    return this.options.auth;
  }
  set auth(val: string|object|undefined) {
    this.options.auth = val;
  }
  get controller() {
    return this.options.controller;
  }
  set controller(val: any|undefined) {
    this.options.controller = val;
  }
  get tags() {
    return this.options.tags;
  }
  set tags(val: [string]|undefined) {
    this.options.tags = val;
  }

  get validate(): Validations {
    const validate = {};

    Object.defineProperty(validate, 'payload', {
      get: () => {
        return this.options.validatePayload;
      },
      set: (val) => {
        this.options.validatePayload = val;
      }
    });
    Object.defineProperty(validate, 'params', {
      get: () => {
        return this.options.validateParams;
      },
      set: (val) => {
        this.options.validateParams = val;
      }
    });
    Object.defineProperty(validate, 'query', {
      get: () => {
        return this.options.validateQuery;
      },
      set: (val) => {
        this.options.validateQuery = val;
      }
    });

    return validate;
  }

  joinName(baseName: string) {
    const name = baseName ? `${baseName}.${this.name}` : this.name;
    return name;
  }

  joinPath(basePath: string) {
    let path = basePath;
    if (this.path !== ROOT) {
      if (basePath === '/') {
        path = `/${this.path}`;
      } else {
        path = `${basePath}/${this.path}`;
      }
    }
    return path;
  }

  visit(baseName: string, basePath: string, visitor: ResourceNodeVisitor): boolean {
    return true;
  }
}

export class Route extends ResourceNode {
  method: HttpMethod;
  action: string;
  description?: string;
  notes?: string|[string];
  cache?: object;
  compression?: object;
  cors?: boolean;
  json?: object;
  jsonp?: string;
  log?: object;
  payload?: object;
  plugins?: object;
  response?: object;
  security?: boolean|object;
  state?: object;
  timeout?: object;
  constructor(method: HttpMethod, name: string, path: Path, options: ResourceOptions|null = null) {
    super(name, path, options);
    this.method = method;
    this.action = name;
  }

  visit(name: string, path: string, visitor: ResourceNodeVisitor): boolean {
    return visitor(name, path, this);
  }
}

export class Resource extends ResourceNode {
  children: ResourceChildren;
  constructor(name: string, path: Path, options: ResourceOptions|null = null) {
    super(name, path, options);
    this.children = new Map<string,ResourceNode>();
  }
  
  collection(name: string, builder: ResourceBuilder<CollectionResource>): CollectionResource;
  collection(name: string, path: string, builder: ResourceBuilder<CollectionResource>): CollectionResource;
  collection(name: string, pathOrBuilder: string|ResourceBuilder<CollectionResource>, builder?: ResourceBuilder<CollectionResource>): CollectionResource {
    return this.addSubresource(CollectionResource, name, pathOrBuilder, builder);
  }

  item(name: string, builder: ResourceBuilder<ItemResource>): ItemResource;
  item(name: string, path: string, builder: ResourceBuilder<ItemResource>): ItemResource;
  item(name: string, pathOrBuilder: string|ResourceBuilder<ItemResource>, builder?: ResourceBuilder<ItemResource>): ItemResource {
    return this.addSubresource(ItemResource, name, pathOrBuilder, builder);
  }

  subscription(name: string, builder: ResourceBuilder<SubscriptionResource>): SubscriptionResource;
  subscription(name: string, path: string, builder: ResourceBuilder<SubscriptionResource>): SubscriptionResource;
  subscription(name: string, pathOrBuilder: string|ResourceBuilder<SubscriptionResource>, builder?: ResourceBuilder<SubscriptionResource>): SubscriptionResource {
    return this.addSubresource(SubscriptionResource, name, pathOrBuilder, builder);
  }

  namespace(name: string, builder: ResourceBuilder<NamespaceResource>): NamespaceResource;
  namespace(name: string, path: string, builder: ResourceBuilder<NamespaceResource>): NamespaceResource;
  namespace(name: string, pathOrBuilder: string|ResourceBuilder<NamespaceResource>, builder?: ResourceBuilder<NamespaceResource>): SubscriptionResource {
    return this.addSubresource(NamespaceResource, name, pathOrBuilder, builder);
  }

  group(name: string, builder: ResourceBuilder<GroupResource>): GroupResource {
    const resource = new GroupResource(name, this.options);
    builder(resource);
    this.addChild(resource.name, resource);
    return resource
  }

  addSubresource<T extends Resource>(TCreator: { new (name: string, path: Path, options?: ResourceOptions): T; }, name: string, pathOrBuilder: string|ResourceBuilder<T>, builder?: ResourceBuilder<T>): T
  {
    let path;
    if (typeof pathOrBuilder === 'function') {
      path = name;
      builder = pathOrBuilder;
    } else {
      path = pathOrBuilder;
    }
    const resource = new TCreator(name, path, this.options);
    builder!(resource);
    this.addChild(resource.name, resource);
    return resource;
  }

  create(routeBuilder?: RouteBuilder) {
    return this.route('POST', 'create', routeBuilder);
  }
  update(routeBuilder?: RouteBuilder) {
    return this.route('PUT', 'update', routeBuilder);
  }
  patch(routeBuilder?: RouteBuilder) {
    return this.route('PATCH', 'patch', routeBuilder);
  }
  destroy(routeBuilder?: RouteBuilder) {
    return this.route('DELETE', 'destroy', routeBuilder);
  }
  
  route(method: HttpMethod, name: string, routeBuilder?: RouteBuilder): Route;
  route(method: HttpMethod, name: string, path: string, routeBuilder?: RouteBuilder): Route;
  route(method: HttpMethod, name: string, pathOrBuilder: any = ROOT, routeBuilder?: RouteBuilder): Route {
    return this.addRoute(method, name, pathOrBuilder, routeBuilder);
  }
  
  addRoute(method: HttpMethod, name: string, pathOrBuilder: any = ROOT, routeBuilder?: RouteBuilder): Route {
    let path: Path;
    if (typeof pathOrBuilder === 'function') {
      path = ROOT;
      routeBuilder = pathOrBuilder;
    } else {
      path = pathOrBuilder;
    }
    const route = new Route(method, name, path, this.options);
    if (routeBuilder) {
      routeBuilder(route);
    }
    this.addChild(route.name, route);
    return route;
  }

  addChild(name: string, node: ResourceNode) {
    if (this.children.has(name)) {
      throw new Error(`Duplicate Resource name found: ${name}`);
    }
    this.children.set(name, node);
  }

  visit(baseName: string, basePath: string, visitor: ResourceNodeVisitor): boolean {
    for (const key of this.children.keys()) {
      const node = this.children.get(key)!;
      const name = node.joinName(baseName);
      const path = node.joinPath(basePath);
      if (!node.visit(name, path, visitor)) {
        return false;
      }
    }
    return true;
  }
}

export class CollectionResource extends Resource {
  itemsResource?: CollectionItemResource;
  index(routeBuilder?: RouteBuilder) {
    return this.route('GET', 'index', routeBuilder);
  }
  items(name: string, builder: ResourceBuilder<ItemResource>) {
    if (!this.itemsResource) {
      this.itemsResource = new CollectionItemResource(name, ROOT, this.options);
    }
    builder(this.itemsResource);
    return this.itemsResource;
  }
  group(name: string, builder: ResourceBuilder<CollectionGroupResource>): CollectionGroupResource {
    const resource = new CollectionGroupResource(name, this.options);
    builder(resource);
    this.addChild(resource.name, resource);
    return resource
  }
  visit(baseName: string, basePath: string, visitor: ResourceNodeVisitor): boolean {
    if (!super.visit(baseName, basePath, visitor)) {
      return false;
    }
    if (this.itemsResource) {
      const node = this.itemsResource;
      const name = `${baseName}[${node.name}]`;
      const path = `${basePath}/{${node.name}}`;
      if (!node.visit(name, path, visitor)) {
        return false;
      }
    }
    return true;
  }
}

export class ItemResource extends Resource {
  show(routeBuilder?: RouteBuilder) {
    return this.route('GET', 'show', routeBuilder);
  }
  group(name: string, builder: ResourceBuilder<ItemGroupResource>): ItemGroupResource {
    const resource = new ItemGroupResource(name, this.options);
    builder(resource);
    this.addChild(resource.name, resource);
    return resource
  }
}

export class CollectionItemResource extends ItemResource {
}

export class SubscriptionResource extends Resource {
}

export class NamespaceResource extends Resource {
}

export class GroupResource extends Resource {
  constructor(name: string, options: ResourceOptions|null = null) {
    super(name, ROOT, options);
  }

  joinName(baseName: string) {
    return baseName;
  }

  joinPath(basePath: string) {
    return basePath;
  }
}

export class CollectionGroupResource extends GroupResource {
  itemsResource?: CollectionItemResource;
  index(routeBuilder?: RouteBuilder) {
    return this.route('GET', 'index', routeBuilder);
  }
  items(name: string, builder: ResourceBuilder<ItemResource>) {
    if (!this.itemsResource) {
      this.itemsResource = new CollectionItemResource(name, ROOT, this.options);
    }
    builder(this.itemsResource);
    return this.itemsResource;
  }
  visit(baseName: string, basePath: string, visitor: ResourceNodeVisitor): boolean {
    if (!super.visit(baseName, basePath, visitor)) {
      return false;
    }
    if (this.itemsResource) {
      const node = this.itemsResource;
      const name = `${baseName}[${node.name}]`;
      const path = `${basePath}/{${node.name}}`;
      if (!node.visit(name, path, visitor)) {
        return false;
      }
    }
    return true;
  }
}

export class ItemGroupResource extends GroupResource {
  show(routeBuilder?: RouteBuilder) {
    return this.route('GET', 'show', routeBuilder);
  }
}

export interface ResourceRouterOptions {
  basePath?: string;
}

type ResourceRouterRoutes = {
  [name: string]: {
    path: string,
    route: Route
  }
};

class ResourceRouter extends Resource {
  static create(options: ResourceRouterOptions, builder: ResourceBuilder<ResourceRouter>) {
    const map = new ResourceRouter(options);
    builder(map);
    map.build();
    return map;
  }
  mapOptions: ResourceRouterOptions;
  routes: ResourceRouterRoutes;
  constructor(mapOptions: ResourceRouterOptions) {
    super('ROUTER', ROOT);
    this.mapOptions = mapOptions;
    this.routes = {};
  }
  build() {
    this.visit('', this.mapOptions.basePath || '/', (canonicalName, path, route) => {
      if (this.routes[canonicalName]) {
        throw new Error(`Duplicate route name: ${canonicalName}`);
      }
      this.routes[canonicalName] = {
        path,
        route
      }
      return true;
    });
  }
}

export default ResourceRouter;
