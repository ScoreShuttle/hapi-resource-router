import Hapi from '@hapi/hapi';

const HomeController = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async home(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    return {
      hello: 'world',
    };
  },
  async getBanana() {
    return 'banana!';
  },
};

export default HomeController;
