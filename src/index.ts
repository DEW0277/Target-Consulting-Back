import fs from 'fs';
import path from 'path';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register() {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    try {
      console.log('--- Configuring Public Permissions Programmatically ---');

      const publicPermissions = [
        'api::about.about.find',
        'api::about.about.findOne',
        'api::about-detail.about-detail.find',
        'api::about-detail.about-detail.findOne',
        'api::country.country.find',
        'api::country.country.findOne',
        'api::gallery.gallery.find',
        'api::gallery.gallery.findOne',
        'api::partner.partner.find',
        'api::partner.partner.findOne',
        'api::service.service.find',
        'api::service.service.findOne',
        'api::social-media.social-media.find',
        'api::social-media.social-media.findOne',
        'api::team.team.find',
        'api::team.team.findOne',
        'api::telegram-post.telegram-post.find',
        'api::telegram-post.telegram-post.findOne',
        'api::term.term.find',
        'api::term.term.findOne',
        'api::user-agreement.user-agreement.find',
        'api::user-agreement.user-agreement.findOne',
        'api::university.university.find',
        'api::university.university.findOne',
        'api::comment.comment.find',
        'api::comment.comment.findOne',
        'api::faq.faq.find',
        'api::faq.faq.findOne',
      ];

      const roleQuery = strapi.db.query('plugin::users-permissions.role');
      const permissionQuery = strapi.db.query('plugin::users-permissions.permission');

      // Find the 'public' role
      const publicRole = await roleQuery.findOne({
        where: { type: 'public' },
      });

      if (publicRole) {
        console.log(`Found Public Role (ID: ${publicRole.id}). Resolving permissions...`);

        // Fetch existing permissions for the public role
        const existingPermissions = await permissionQuery.findMany({
          where: { role: publicRole.id },
        });

        const existingActions = new Set(existingPermissions.map((p: any) => p.action));

        // 1. Update existing matching permissions to be enabled: true
        await Promise.all(
          existingPermissions.map((permission: any) => {
            if (publicPermissions.includes(permission.action)) {
              if (permission.enabled) return null; // Already enabled
              
              console.log(`Enabling permission: ${permission.action}`);
              return permissionQuery.update({
                where: { id: permission.id },
                data: { enabled: true },
              });
            }
            return null;
          }).filter(Boolean)
        );

        // 2. Create missing permissions
        const missingActions = publicPermissions.filter((action) => !existingActions.has(action));

        if (missingActions.length > 0) {
          console.log(`Creating ${missingActions.length} missing permissions...`);
          await Promise.all(
            missingActions.map((action) => {
              console.log(`Creating permission: ${action}`);
              return permissionQuery.create({
                data: {
                  action,
                  role: publicRole.id,
                  enabled: true,
                  conditions: [],
                  properties: {},
                },
              });
            })
          );
        }

        console.log('--- Public Permissions Successfully Configured! ---');
      } else {
        console.warn('Public role was not found in the database.');
      }

      // --- AUTOMATIC DATA HEALING FOR TELEGRAM POSTS ---
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        console.log('--- Starting Telegram Posts Auto-Healing Script ---');
        const posts = await strapi.documents('api::telegram-post.telegram-post').findMany({
          status: 'published',
        });

        if (posts && posts.length > 0) {
          for (const post of posts) {
            const mediaUrl = post.mediaUrl || '';
            // If mediaUrl is a raw Telegram file_id (does not start with http or /uploads)
            if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('/uploads')) {
              console.log(`Auto-fixing Telegram post ID: ${post.id} (file_id: ${mediaUrl})`);
              try {
                // 1. Fetch file path from Telegram API
                const fileInfoRes = await fetch(
                  `https://api.telegram.org/bot${botToken}/getFile?file_id=${mediaUrl}`
                );
                const fileInfo = (await fileInfoRes.json()) as any;

                if (fileInfo.ok && fileInfo.result?.file_path) {
                  const filePath = fileInfo.result.file_path;

                  // 2. Fetch the file buffer from Telegram
                  const fileRes = await fetch(
                    `https://api.telegram.org/file/bot${botToken}/${filePath}`
                  );
                  const arrayBuffer = await fileRes.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);

                  // 3. Save buffer to temp directory
                  const tempDir = path.join(process.cwd(), '.tmp');
                  if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                  }
                  const filename = `telegram_${post.telegramId || post.id}_${path.basename(filePath)}`;
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
                    },
                  });

                  if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                  }

                  if (uploaded && uploaded.length > 0) {
                    const localMediaUrl = uploaded[0].url;
                    // Update document
                    await strapi.documents('api::telegram-post.telegram-post').update({
                      documentId: post.documentId,
                      data: {
                        mediaUrl: localMediaUrl,
                      },
                    });
                    console.log(
                      `Successfully auto-fixed post ID: ${post.id}. Local URL: ${localMediaUrl}`
                    );
                  }
                } else {
                  console.error(
                    `Telegram API getFile failed for post ID: ${post.id}`,
                    fileInfo
                  );
                }
              } catch (err) {
                console.error(`Failed to auto-fix post ID: ${post.id}:`, err);
              }
            }
          }
        }
        console.log('--- Telegram Posts Auto-Healing Script Finished ---');
      } else {
        console.warn('TELEGRAM_BOT_TOKEN is missing, skipping auto-healing.');
      }
    } catch (error) {
      console.error('Failed to run bootstrap logic:', error);
    }
  },
};
