export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:8081',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://targett.uz',
        'https://www.targett.uz',
        'https://api.targett.uz',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb',
      jsonLimit: '256mb',
      textLimit: '256mb',
      xmlLimit: '256mb',
      formidable: {
        maxFileSize: 250 * 1024 * 1024, // 250MB
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
