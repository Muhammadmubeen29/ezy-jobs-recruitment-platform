const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EZY Jobs API',
      version: '1.0.0',
      description:
        'EZY Jobs API is a RESTful API for the EZY Jobs application, a talent acquisition and hiring platform.',
      contact: {
        name: 'EZY Jobs Team',
        url: 'https://opta-hire-fyp-app-client.vercel.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development server',
      },
      {
        url: 'https://opta-hire-develop-server.vercel.app',
        description: 'Vercel Development Server',
      },
      {
        url: 'https://opta-hire-fyp-app-server-4ca9bd7992ab.herokuapp.com',
        description: 'Heroku Production Server',
      },
    ],
  },
  security: [],
  apis: ['./docs/*.js'],
};

module.exports = swaggerOptions;
