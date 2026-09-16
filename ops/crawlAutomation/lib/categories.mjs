export const CATEGORIES = [
  {
    key: 'ResidentialRent',
    displayName: 'Residential Rent',
    url: '/ResidentialRent.php',
    ajaxUrl: '/ajaxpropertydatatable.php',
    guid: 'c7f77b53-1a4c-4fe7-1c9e-5147f5e13535',
    countCategory: 'Residential Rent',
    type: 'main',
  },
  {
    key: 'ResidentialSell',
    displayName: 'Residential Sell',
    url: '/ResidentialSell.php',
    ajaxUrl: '/ajaxpropertydatatable.php',
    guid: '337b7338-d305-ae3c-304b-5147f5ccf3f9',
    countCategory: 'Residential Sell',
    type: 'main',
  },
  {
    key: 'CommercialRent',
    displayName: 'Commercial Rent',
    url: '/CommercialRent.php',
    ajaxUrl: '/ajaxpropertydatatable.php',
    guid: 'a40ec292-c8dd-bb7f-6470-5147f5b8e625',
    countCategory: 'Commercial Rent',
    type: 'main',
  },
  {
    key: 'CommercialSell',
    displayName: 'Commercial Sell',
    url: '/CommercialSell.php',
    ajaxUrl: '/ajaxpropertydatatable.php',
    guid: 'b2e312a4-7af1-2c47-0082-5147f5fd18a3',
    countCategory: 'Commercial Sell',
    type: 'main',
  },
  {
    key: 'Premium',
    displayName: 'Premium Properties',
    url: '/premiumPropList.php',
    ajaxUrl: '/ajaxpremiumpropdatatable.php',
    guid: null,
    countCategory: null,
    type: 'premium',
  },
  {
    key: 'Important',
    displayName: 'Shortlisted Properties',
    url: '/importantPropList.php',
    ajaxUrl: '/ajaximppropdatatable.php',
    guid: null,
    countCategory: null,
    type: 'important',
  },
];

export function getCategoryByKey(key) {
  return CATEGORIES.find(c => c.key === key);
}
