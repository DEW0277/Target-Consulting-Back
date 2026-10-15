/**
 * subscriber controller
 */

import { factories } from '@strapi/strapi';

import { clientIp, isRateLimited } from '../../../utils/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default factories.createCoreController('api::subscriber.subscriber', ({ strapi }) => ({
  async create(ctx) {
    if (isRateLimited(`subscriber:${clientIp(ctx)}`, 5)) {
      return ctx.tooManyRequests('Too many requests, please try again later.');
    }
    const data = ctx.request.body?.data ?? {};
    const email = String(data.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return ctx.badRequest('A valid email is required.');

    const language = ['uz', 'ru', 'en'].includes(data.language) ? data.language : 'uz';

    // Subscribing twice is not an error for the visitor.
    const existing = await strapi.documents('api::subscriber.subscriber').findFirst({
      filters: { email },
    });
    if (!existing) {
      await strapi.documents('api::subscriber.subscriber').create({ data: { email, language } });
    }
    ctx.body = { ok: true };
  },
}));
