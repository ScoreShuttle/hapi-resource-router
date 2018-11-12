import { expect } from 'code';
import Lab from 'lab';
export const lab = Lab.script();
const { describe, it } = lab;
import Hapi from 'hapi';

import Plugin from '../lib/Plugin';
import Routes from './helpers/Routes';

describe('Plugin', () => {
  it('registers', async () => {

    const server: Hapi.Server = new Hapi.Server();
    await server.register({ plugin: Plugin, options: {
      basePath: '/api'
    } });
    server.resources().add(Routes);
    await server.start();

    const response = await server.inject({
      method: 'GET',
      url: '/api'
    });
    expect(JSON.parse(response.payload)).to.equal({
      hello: 'world'
    });

    const response2 = await server.inject({
      method: 'GET',
      url: '/api/banana'
    });
    expect(response2.payload).to.equal('banana!');

    const response3 = await server.inject({
      method: 'DELETE',
      url: '/api/users/1'
    });
    const users = JSON.parse(response3.payload);
    const userIds = users.map(user => user.id);
    expect(userIds).to.not.contain(1);
  });
});
