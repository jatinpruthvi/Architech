import { createHash } from 'crypto';

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextContent(html) {
  if (!html) return '';
  const text = stripHtml(html);
  return text.replace(/\s*\|\s*read more\s*$/i, '').trim();
}

function extractPremiseText(html) {
  if (!html) return '';
  const match = html.match(/>([^<]+)<\/a>$/);
  if (match) return match[1].trim();
  return stripHtml(html);
}

function extractPropId(col0, col18) {
  let m = (col0 || '').match(/sharepropertylink_([0-9a-f-]{36})/);
  if (m) return m[1];
  m = (col18 || '').match(/rentedout_([0-9a-f-]{36})/);
  if (m) return m[1];
  m = (col0 || '').match(/dskimpprop_([0-9a-f-]{36})/);
  if (m) return m[1];
  m = (col0 || '').match(/whatsapplink_([0-9a-f-]{36})/);
  if (m) return m[1];
  return null;
}

function extractDatePart(raw) {
  if (!raw) return '';
  const m = raw.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : stripHtml(raw);
}

function extractAgePart(raw) {
  if (!raw) return '';
  const parts = (raw || '').split('<br');
  if (parts.length < 2) return '';
  const after = parts.slice(1).join('<br');
  return stripHtml(after);
}

function extractRentPrice(raw) {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim();
}

function isContactRevealed(col4) {
  if (!col4) return false;
  if (col4.includes('dt-contact-btn')) return false;
  return /\d{10}/.test(col4);
}

function extractContact(col4) {
  if (!col4) return null;
  if (col4.includes('dt-contact-btn')) return null;
  const m = col4.match(/^(.+?)\s*(?:<br\s*\/?>|[\n\r]+)\s*(\d{10})/);
  if (m) return { name: m[1].trim(), phone: m[2] };
  const phoneMatch = col4.match(/(\d{10})/);
  if (phoneMatch) return { name: stripHtml(col4).replace(phoneMatch[1], '').trim(), phone: phoneMatch[1] };
  return { name: stripHtml(col4), phone: '' };
}

function extractContactBtnId(col4) {
  if (!col4) return null;
  const m = col4.match(/id="(getcntinfo_[A-Za-z0-9+/=]+)"/);
  if (m) return m[1];
  return null;
}

function extractHasGallery(col0) {
  return (col0 || '').includes('js-image-gallery');
}

function extractIsRentedOut(col18) {
  if (!col18) return false;
  return col18.includes('checked');
}

function extractNoteText(col1) {
  if (!col1) return '';
  const m = col1.match(/dt-splnote-raw[^>]*>([^<]*)</);
  return m ? m[1].trim() : '';
}

function extractPropertyType(col2) {
  return stripHtml(col2);
}

function computeRowHash(props) {
  const stable = [
    props.property_type,
    props.date_posted,
    props.address,
    props.premise_name,
    props.area,
    props.rent_price_raw,
    props.availability_raw,
    props.condition_raw,
    props.description_raw,
    props.furniture_raw,
    props.sqft_raw,
    props.key_info,
    props.brokerage,
    props.status,
    props.is_rented_out ? '1' : '0',
    props.has_gallery ? '1' : '0',
    props.note_raw,
  ];
  return createHash('sha256').update(stable.join('\0')).digest('hex');
}

export function parseRow(rowArray, categoryKey, context) {
  const col0 = rowArray[0] || '';
  const col1 = rowArray[1] || '';
  const col2 = rowArray[2] || '';
  const col3 = rowArray[3] || '';
  const col4 = rowArray[4] || '';
  const col5 = rowArray[5] || '';
  const col6 = rowArray[6] || '';
  const col7 = rowArray[7] || '';
  const col8 = rowArray[8] || '';
  const col9 = rowArray[9] || '';
  const col10 = rowArray[10] || '';
  const col11 = rowArray[11] || '';
  const col12 = rowArray[12] || '';
  const col13 = rowArray[13] || '';
  const col14 = rowArray[14] || '';
  const col15 = rowArray[15] || '';
  const col16 = rowArray[16] || '';
  const col17 = rowArray[17] || '';
  const col18 = rowArray[18] || '';

  const propertyId = extractPropId(col0, col18);
  if (!propertyId) return null;

  const hasGallery = extractHasGallery(col0);
  const isRentedOut = extractIsRentedOut(col18);
  const noteRaw = extractNoteText(col1);
  const contactRevealed = isContactRevealed(col4);
  const contact = contactRevealed ? extractContact(col4) : null;
  const contactBtnId = !contactRevealed ? extractContactBtnId(col4) : null;

  const props = {
    property_id: propertyId,
    contact_btn_id: contactBtnId,
    category_key: categoryKey,
    property_type: extractPropertyType(col2),
    date_posted: extractDatePart(col3),
    address: extractTextContent(col5),
    premise_name: extractPremiseText(col6),
    area: stripHtml(col7),
    rent_price_raw: extractRentPrice(col8),
    availability_raw: extractTextContent(col9),
    condition_raw: stripHtml(col10),
    property_age: stripHtml(col11),
    description_raw: stripHtml(col12),
    furniture_raw: stripHtml(col13),
    sqft_raw: stripHtml(col14),
    key_info: stripHtml(col15),
    brokerage: stripHtml(col16),
    status: stripHtml(col17),
    is_rented_out: isRentedOut,
    has_gallery: hasGallery,
    note_raw: noteRaw,
    contact_revealed_in_listing: contactRevealed,
    owner_name: contact?.name || null,
    owner_phone: contact?.phone || null,
    is_premium: context?.isPremium ? 1 : 0,
    is_shortlisted: context?.isShortlisted ? 1 : 0,
    _contactBtnId: contactBtnId,
  };

  props.row_hash = computeRowHash(props);
  return props;
}

export function parseListingRows(rows, categoryKey, context) {
  const results = [];
  for (const row of rows) {
    const parsed = parseRow(row, categoryKey, context);
    if (parsed) results.push(parsed);
  }
  return results;
}
