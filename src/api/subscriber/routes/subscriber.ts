/**
 * subscriber router — the public site may only create subscribers.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::subscriber.subscriber', { only: ['create'] });
