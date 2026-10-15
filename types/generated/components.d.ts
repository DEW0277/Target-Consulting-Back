import type { Schema, Struct } from '@strapi/strapi';

export interface SiteExperienceItem extends Struct.ComponentSchema {
  collectionName: 'components_site_experience_items';
  info: {
    description: 'City photo card on the About page';
    displayName: 'Experience item';
    icon: 'earth';
  };
  attributes: {
    city: Schema.Attribute.String & Schema.Attribute.Required;
    country: Schema.Attribute.Enumeration<
      ['USA', 'CA', 'UK', 'AUS', 'DEU', 'NLD', 'LVA']
    > &
      Schema.Attribute.Required;
    image: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'site.experience-item': SiteExperienceItem;
    }
  }
}
