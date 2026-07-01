import { Context } from 'koa';
import fs from 'fs';
import path from 'path';

export default {
  async webhook(ctx: Context) {
    try {
      const body = ctx.request.body as any;

      if (!body) {
        return ctx.badRequest('Body is empty');
      }

      // Telegram webhook payload contains either channel_post or message
      const post = body.channel_post || body.message;

      if (!post) {
        // Return 200 OK to prevent Telegram from continuously retrying the request
        return ctx.send({
          ok: true,
          message: 'Ignored: No channel_post or message found in update'
        });
      }

      const messageId = post.message_id?.toString();
      if (!messageId) {
        return ctx.badRequest('message_id is missing in post');
      }

      // Extract text or caption
      const text = post.text || post.caption || '';

      // Extract date (Unix timestamp in seconds) and convert to ISO string
      const dateTimestamp = post.date;
      if (!dateTimestamp) {
        return ctx.badRequest('date is missing in post');
      }
      const publishedAtDate = new Date(dateTimestamp * 1000).toISOString();

      // Query for existing document with the same telegramId using Strapi v5 Documents API
      const existing = await strapi.documents('api::telegram-post.telegram-post').findFirst({
        filters: {
          telegramId: messageId
        }
      });

      if (existing) {
        return ctx.send({
          ok: true,
          message: 'Post already cached (skipped)',
          telegramId: messageId
        });
      }

      // Extract media URL (file_id) if photo or video or document is present
      let mediaUrl = '';
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      let fileId = '';
      if (post.photo && post.photo.length > 0) {
        // Get the largest photo size file_id
        fileId = post.photo[post.photo.length - 1].file_id;
      } else if (post.video) {
        fileId = post.video.file_id;
      } else if (post.document) {
        fileId = post.document.file_id;
      }

      if (fileId && botToken) {
        try {
          // 1. Fetch file path from Telegram API
          const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
          const fileInfo = await fileInfoRes.json() as any;

          if (fileInfo.ok && fileInfo.result?.file_path) {
            const filePath = fileInfo.result.file_path;

            // 2. Fetch the file buffer from Telegram
            const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 3. Write buffer to a temp file in .tmp directory
            const tempDir = path.join(process.cwd(), '.tmp');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            const filename = `telegram_${messageId}_${path.basename(filePath)}`;
            const tempFilePath = path.join(tempDir, filename);
            fs.writeFileSync(tempFilePath, buffer);

            // 4. Upload file using Strapi Upload service
            const uploadService = strapi.plugin('upload').service('upload');
            const uploaded = await uploadService.upload({
              data: {},
              files: {
                originalFilename: filename,
                mimetype: fileRes.headers.get('content-type') || 'image/jpeg',
                size: buffer.length,
                filepath: tempFilePath,
              }
            });

            // Clean up the temp file
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }

            if (uploaded && uploaded.length > 0) {
              mediaUrl = uploaded[0].url; // e.g. /uploads/telegram_xxx.jpg
            }
          } else {
            mediaUrl = fileId;
          }
        } catch (uploadErr) {
          strapi.log.error('Failed to download/upload Telegram media, falling back to fileId:', uploadErr);
          mediaUrl = fileId;
        }
      } else {
        mediaUrl = fileId;
      }

      // Create new telegram-post document and publish it immediately
      const newDocument = await strapi.documents('api::telegram-post.telegram-post').create({
        data: {
          telegramId: messageId,
          text,
          mediaUrl,
          publishedAtDate,
        },
        status: 'published' // Publish immediately on creation in Strapi v5
      });

      return ctx.send({
        ok: true,
        message: 'Post successfully cached',
        data: newDocument
      });

    } catch (error: any) {
      strapi.log.error('Telegram Webhook error:', error);
      return ctx.internalServerError(error.message || 'Internal server error');
    }
  }
};
