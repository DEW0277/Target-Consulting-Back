/**
 * Keeps `readingTime` in sync with the post body: recalculated whenever the content is saved.
 */
import { readingTime } from '../../../../utils/reading-time';

const fill = (data: Record<string, unknown> | undefined) => {
  if (!data || typeof data.content !== 'string') return;
  const minutes = readingTime(data.content);
  if (minutes) data.readingTime = minutes;
};

export default {
  beforeCreate(event: any) {
    fill(event.params?.data);
  },
  beforeUpdate(event: any) {
    fill(event.params?.data);
  },
};
