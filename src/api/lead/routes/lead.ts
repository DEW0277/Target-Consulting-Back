/**
 * lead router — the public site may only create leads.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::lead.lead', { only: ['create'] });
