import Hapi from 'hapi';

const HomeController = {
  async home(request: Hapi.Request, h: Hapi.ResponseToolkit) {
    return {
      hello: 'world'
    };
  },
  async getBanana() {
    return 'banana!';
  }
};

export default HomeController;