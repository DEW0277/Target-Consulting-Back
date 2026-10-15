/**
 * Sends new website leads to a Telegram chat when TELEGRAM_BOT_TOKEN and
 * TELEGRAM_LEADS_CHAT_ID are configured. Failures never block saving the lead.
 */

const escape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default {
  async afterCreate(event: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_LEADS_CHAT_ID;
    if (!token || !chatId) return;

    const lead = event.result ?? {};
    const lines = [
      '<b>Yangi ariza — targett.uz</b>',
      `Ism: ${escape(lead.name)}`,
      `Telefon: ${escape(lead.phone)}`,
      lead.email && `Email: ${escape(lead.email)}`,
      lead.country && `Davlat: ${escape(lead.country)}`,
      lead.level && `Daraja: ${escape(lead.level)}`,
      lead.message && `Xabar: ${escape(lead.message)}`,
      `Til: ${escape(lead.language)} · Manba: ${escape(lead.source)}`,
    ].filter(Boolean);

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' }),
      });
    } catch (error) {
      strapi.log.warn(`Lead Telegram notification failed: ${(error as Error).message}`);
    }
  },
};
