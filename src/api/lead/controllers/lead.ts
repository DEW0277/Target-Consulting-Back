/**
 * lead controller
 */

import { factories } from '@strapi/strapi';

import { clientIp, isRateLimited } from '../../../utils/rate-limit';

export default factories.createCoreController('api::lead.lead', () => ({
  async create(ctx) {
    if (isRateLimited(`lead:${clientIp(ctx)}`, 5)) {
      return ctx.tooManyRequests('Too many requests, please try again later.');
    }
    const data = ctx.request.body?.data ?? {};
    // Status is managed by staff in the admin panel only.
    delete data.status;
    ctx.request.body = { data };

    await super.create(ctx);
    // Don't echo stored records back to anonymous visitors.
    ctx.body = { ok: true };
  },
}));
