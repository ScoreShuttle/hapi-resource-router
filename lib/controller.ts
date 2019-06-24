import Hapi from 'hapi';
import { AnySchema } from 'joi';

type ControllerAction = Hapi.Lifecycle.Method;

export type JoiThing = Hapi.ValidationObject|AnySchema;
export type Validator = { [action: string]: JoiThing }|((action: string) => JoiThing);

export interface Validate {
  payload?: Validator;
  params?: Validator;
  query?: Validator;
  response?: Validator;
}

type ControllerObject = {
  validate?: Validate;
  [action: string]: ControllerAction|any;
};

type ControllerInstance = {
  constructor: {
    validate?: Validate;
  }
  [action: string]: ControllerAction|any;
};

export type Controller = ControllerObject|ControllerInstance;

export type ControllerClass = new (...args: any) => ControllerInstance;
