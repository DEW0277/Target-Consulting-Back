import fs from 'fs';
import path from 'path';

/**
 * One-time seed: adds the uz/ru/kk/ky/tg/tr/az versions of every university (description and
 * city) from data/university-translations.json, and cleans up a few English entries.
 *
 * - Entries are matched by the id of their published English row and checked against the name.
 * - A locale that already exists is never overwritten, so edits made in the admin are kept.
 * - Runs once per data version (remembered in the core store); safe to restart mid-way.
 */

const UID = 'api::university.university';
const STORE_KEY = 'university-translations-v1';
const LOCALES = ['uz', 'ru', 'kk', 'ky', 'tg', 'tr', 'az'];

type Entry = Record<string, string>;
interface Payload {
  unis: Record<string, Entry>;
  cities: Record<string, Record<string, string>>;
  setCountry: Record<string, string>;
}

const cleanName = (name: string) => name.replace(/﻿/g, '').replace(/\s+/g, ' ').trim();

export async function seedUniversityTranslations(strapi: any) {
  const file = path.join(strapi.dirs.app.root, 'data', 'university-translations.json');
  if (!fs.existsSync(file)) return;

  const store = strapi.store({ type: 'core', name: 'target-seed' });
  if (await store.get({ key: STORE_KEY })) return;

  const i18n = strapi.plugin('i18n');
  const ct = strapi.contentType(UID);
  if (!i18n || !ct?.pluginOptions?.i18n?.localized) {
    strapi.log.warn('[seed] University is not localized yet; skipping translations.');
    return;
  }

  const data: Payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const docs = strapi.documents(UID);

  const countries = await strapi.documents('api::country.country').findMany({ fields: ['name'] });
  const countryDoc: Record<string, string> = {};
  countries.forEach((c: any) => {
    if (c.name) countryDoc[c.name] = c.documentId;
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const [id, entry] of Object.entries(data.unis)) {
    try {
      const row = await strapi.db.query(UID).findOne({
        where: { id: Number(id) },
        populate: { country: { select: ['documentId'] } },
      });
      if (!row) {
        skipped += 1;
        continue;
      }
      const { documentId } = row;
      const en = await docs.findOne({ documentId, locale: 'en', populate: { country: true } });
      if (!en) {
        skipped += 1;
        continue;
      }

      // English clean-ups: stray characters in names, broken descriptions, missing country.
      const enPatch: Record<string, unknown> = {};
      if (cleanName(en.name) !== en.name) enPatch.name = cleanName(en.name);
      if (entry.en && entry.en !== en.description) enPatch.description = entry.en;
      const wantedCountry = data.setCountry[id];
      if (!en.country && wantedCountry && countryDoc[wantedCountry]) {
        enPatch.country = countryDoc[wantedCountry];
      }
      if (Object.keys(enPatch).length) {
        await docs.update({ documentId, locale: 'en', data: enPatch });
        await docs.publish({ documentId, locale: 'en' });
      }

      const country = (enPatch.country as string) || en.country?.documentId || null;
      const enCity = (en.city || '').trim();

      for (const locale of LOCALES) {
        if (!entry[locale]) continue;
        // eslint-disable-next-line no-await-in-loop
        const existing = await docs.findOne({ documentId, locale });
        if (existing) {
          skipped += 1;
          continue;
        }
        const city = enCity ? data.cities[enCity]?.[locale] || enCity : null;
        // eslint-disable-next-line no-await-in-loop
        await docs.update({
          documentId,
          locale,
          data: { description: entry[locale], city, ...(country ? { country } : {}) },
        });
        // eslint-disable-next-line no-await-in-loop
        await docs.publish({ documentId, locale });
        created += 1;
      }
    } catch (error) {
      failed += 1;
      strapi.log.error(`[seed] University ${id}: ${(error as Error).message}`);
    }
  }

  strapi.log.info(
    `[seed] University translations: ${created} created, ${skipped} skipped, ${failed} failed.`
  );
  if (!failed) await store.set({ key: STORE_KEY, value: { done: new Date().toISOString() } });
}
