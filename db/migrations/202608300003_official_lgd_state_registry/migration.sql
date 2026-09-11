-- Load the complete official LGD State/Union Territory identity registry.
-- Source snapshot: data/location/official/lgd-state-ut-2026-08-30.json
-- This is administrative identity only; it does not manufacture product cities
-- or claim that a PIN identifies a locality.

INSERT INTO "LocationSource" (
    "id", "key", "name", "publisher", "sourceUrl", "downloadUrl",
    "licenseName", "licenseUrl", "attribution", "version", "checksumSha256",
    "publishedAt", "retrievedAt", "status", "metadata", "createdAt", "updatedAt"
) VALUES (
    'locsrc_lgd_state_ut_20260830',
    'lgd-state-ut-registry-2026-08-30',
    'Local Government Directory Codes of States/Union Territories',
    'Ministry of Panchayati Raj, Government of India',
    'https://lgdirectory.gov.in/globalviewstateforcitizen.do',
    'https://www.data.gov.in/catalog/local-government-directory-lgd',
    'Government Open Data License - India',
    'https://ap.data.gov.in/godl',
    'Ministry of Panchayati Raj, 2026, Local Government Directory Codes of States/Union Territories, LGD/OGD Platform India, 30/08/2026. Published under Government Open Data License - India.',
    '2026-08-30',
    '7e1f421512b11b92696364d1ce3508f5da050bd81c1f0f0a9d24b3eaf94d3aa9',
    '2026-08-30T15:07:53.000Z'::timestamp,
    '2026-08-30T15:07:53.000Z'::timestamp,
    'ACTIVE',
    '{"schemaVersion":"architech-lgd-state-ut-v1","recordCount":36,"states":28,"unionTerritories":8}'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO UPDATE SET
    "sourceUrl" = EXCLUDED."sourceUrl",
    "downloadUrl" = EXCLUDED."downloadUrl",
    "licenseName" = EXCLUDED."licenseName",
    "licenseUrl" = EXCLUDED."licenseUrl",
    "attribution" = EXCLUDED."attribution",
    "version" = EXCLUDED."version",
    "checksumSha256" = EXCLUDED."checksumSha256",
    "retrievedAt" = EXCLUDED."retrievedAt",
    "status" = 'ACTIVE',
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AdministrativeArea" (
    "id", "type", "code", "name", "nativeName", "slug", "subtype", "metadata",
    "sourceId", "sourceFeatureId", "validFrom", "isActive", "createdAt", "updatedAt"
) VALUES (
    'admin_lgd_country_in', 'COUNTRY', 'IN', 'India', 'भारत', 'india', 'Country',
    '{"isoAlpha2":"IN"}'::jsonb, 'locsrc_lgd_state_ut_20260830', 'country:IN',
    '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT ("sourceId", "type", "code") DO UPDATE SET
    "name" = EXCLUDED."name", "nativeName" = EXCLUDED."nativeName",
    "slug" = EXCLUDED."slug", "subtype" = EXCLUDED."subtype",
    "metadata" = EXCLUDED."metadata", "isActive" = true,
    "validTo" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AdministrativeArea" (
    "id", "type", "code", "name", "nativeName", "slug", "subtype", "metadata",
    "parentId", "sourceId", "sourceFeatureId", "validFrom", "isActive", "createdAt", "updatedAt"
) VALUES
    ('admin_lgd_state_35', 'STATE_OR_UT', '35', 'Andaman And Nicobar Islands', 'ANDAMAN AND NICOBAR ISLANDS', 'andaman-and-nicobar-islands', 'Union Territory', '{"kind":"UT","census2001Code":"35","census2011Code":"35"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:35', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_28', 'STATE_OR_UT', '28', 'Andhra Pradesh', 'ANDHRA PRADESH', 'andhra-pradesh', 'State', '{"kind":"STATE","census2001Code":"28","census2011Code":"28"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:28', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_12', 'STATE_OR_UT', '12', 'Arunachal Pradesh', 'ARUNACHAL PRADESH', 'arunachal-pradesh', 'State', '{"kind":"STATE","census2001Code":"12","census2011Code":"12"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:12', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_18', 'STATE_OR_UT', '18', 'Assam', 'ASSAM', 'assam', 'State', '{"kind":"STATE","census2001Code":"18","census2011Code":"18"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:18', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_10', 'STATE_OR_UT', '10', 'Bihar', 'BIHAR', 'bihar', 'State', '{"kind":"STATE","census2001Code":"10","census2011Code":"10"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:10', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_4', 'STATE_OR_UT', '4', 'Chandigarh', 'CHANDIGARH', 'chandigarh', 'Union Territory', '{"kind":"UT","census2001Code":"04","census2011Code":"04"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:4', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_22', 'STATE_OR_UT', '22', 'Chhattisgarh', 'छत्तीसगढ़', 'chhattisgarh', 'State', '{"kind":"STATE","census2001Code":"22","census2011Code":"22"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:22', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_7', 'STATE_OR_UT', '7', 'Delhi', 'DELHI', 'delhi', 'Union Territory', '{"kind":"UT","census2001Code":"07","census2011Code":"07"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:7', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_30', 'STATE_OR_UT', '30', 'Goa', 'GOA', 'goa', 'State', '{"kind":"STATE","census2001Code":"30","census2011Code":"30"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:30', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_24', 'STATE_OR_UT', '24', 'Gujarat', 'GUJARAT', 'gujarat', 'State', '{"kind":"STATE","census2001Code":"24","census2011Code":"24"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:24', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_6', 'STATE_OR_UT', '6', 'Haryana', 'HARYANA', 'haryana', 'State', '{"kind":"STATE","census2001Code":"06","census2011Code":"06"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:6', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_2', 'STATE_OR_UT', '2', 'Himachal Pradesh', 'HIMACHAL PRADESH', 'himachal-pradesh', 'State', '{"kind":"STATE","census2001Code":"02","census2011Code":"02"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:2', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_1', 'STATE_OR_UT', '1', 'Jammu And Kashmir', 'JAMMU AND KASHMIR', 'jammu-and-kashmir', 'Union Territory', '{"kind":"UT","census2001Code":"01","census2011Code":"01"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:1', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_20', 'STATE_OR_UT', '20', 'Jharkhand', 'झारखंड', 'jharkhand', 'State', '{"kind":"STATE","census2001Code":"20","census2011Code":"20"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:20', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_29', 'STATE_OR_UT', '29', 'Karnataka', 'ಕರ್ನಾಟಕ', 'karnataka', 'State', '{"kind":"STATE","census2001Code":"29","census2011Code":"29"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:29', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_32', 'STATE_OR_UT', '32', 'Kerala', 'KERALA', 'kerala', 'State', '{"kind":"STATE","census2001Code":"32","census2011Code":"32"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:32', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_37', 'STATE_OR_UT', '37', 'Ladakh', 'Ladakh', 'ladakh', 'Union Territory', '{"kind":"UT","census2001Code":null,"census2011Code":"00"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:37', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_31', 'STATE_OR_UT', '31', 'Lakshadweep', 'LAKSHADWEEP', 'lakshadweep', 'Union Territory', '{"kind":"UT","census2001Code":"31","census2011Code":"31"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:31', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_23', 'STATE_OR_UT', '23', 'Madhya Pradesh', 'MADHYA PRADESH', 'madhya-pradesh', 'State', '{"kind":"STATE","census2001Code":"23","census2011Code":"23"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:23', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_27', 'STATE_OR_UT', '27', 'Maharashtra', 'महाराष्ट्र', 'maharashtra', 'State', '{"kind":"STATE","census2001Code":"27","census2011Code":"27"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:27', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_14', 'STATE_OR_UT', '14', 'Manipur', 'MANIPUR', 'manipur', 'State', '{"kind":"STATE","census2001Code":"14","census2011Code":"14"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:14', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_17', 'STATE_OR_UT', '17', 'Meghalaya', 'MEGHALAYA', 'meghalaya', 'State', '{"kind":"STATE","census2001Code":"17","census2011Code":"17"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:17', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_15', 'STATE_OR_UT', '15', 'Mizoram', 'MIZORAM', 'mizoram', 'State', '{"kind":"STATE","census2001Code":"15","census2011Code":"15"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:15', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_13', 'STATE_OR_UT', '13', 'Nagaland', 'NAGALAND', 'nagaland', 'State', '{"kind":"STATE","census2001Code":"13","census2011Code":"13"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:13', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_21', 'STATE_OR_UT', '21', 'Odisha', 'ଓଡ଼ିଶା', 'odisha', 'State', '{"kind":"STATE","census2001Code":"21","census2011Code":"21"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:21', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_34', 'STATE_OR_UT', '34', 'Puducherry', 'PUDUCHERRY', 'puducherry', 'Union Territory', '{"kind":"UT","census2001Code":"34","census2011Code":"34"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:34', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_3', 'STATE_OR_UT', '3', 'Punjab', 'PUNJAB', 'punjab', 'State', '{"kind":"STATE","census2001Code":"03","census2011Code":"03"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:3', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_8', 'STATE_OR_UT', '8', 'Rajasthan', 'RAJASTHAN', 'rajasthan', 'State', '{"kind":"STATE","census2001Code":"08","census2011Code":"08"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:8', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_11', 'STATE_OR_UT', '11', 'Sikkim', 'SIKKIM', 'sikkim', 'State', '{"kind":"STATE","census2001Code":"11","census2011Code":"11"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:11', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_33', 'STATE_OR_UT', '33', 'Tamil Nadu', 'TAMIL NADU', 'tamil-nadu', 'State', '{"kind":"STATE","census2001Code":"33","census2011Code":"33"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:33', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_36', 'STATE_OR_UT', '36', 'Telangana', 'తెలంగాణ', 'telangana', 'State', '{"kind":"STATE","census2001Code":null,"census2011Code":"00"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:36', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_38', 'STATE_OR_UT', '38', 'The Dadra And Nagar Haveli And Daman And Diu', 'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU', 'the-dadra-and-nagar-haveli-and-daman-and-diu', 'Union Territory', '{"kind":"UT","census2001Code":null,"census2011Code":null}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:38', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_16', 'STATE_OR_UT', '16', 'Tripura', 'ত্রিপুরা', 'tripura', 'State', '{"kind":"STATE","census2001Code":"16","census2011Code":"16"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:16', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_5', 'STATE_OR_UT', '5', 'Uttarakhand', 'UTTARAKHAND', 'uttarakhand', 'State', '{"kind":"STATE","census2001Code":"05","census2011Code":"05"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:5', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_9', 'STATE_OR_UT', '9', 'Uttar Pradesh', 'UTTAR PRADESH', 'uttar-pradesh', 'State', '{"kind":"STATE","census2001Code":"09","census2011Code":"09"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:9', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('admin_lgd_state_19', 'STATE_OR_UT', '19', 'West Bengal', 'WEST BENGAL', 'west-bengal', 'State', '{"kind":"STATE","census2001Code":"19","census2011Code":"19"}'::jsonb, 'admin_lgd_country_in', 'locsrc_lgd_state_ut_20260830', 'state:19', '2026-08-30T15:07:53.000Z'::timestamp, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("sourceId", "type", "code") DO UPDATE SET
    "name" = EXCLUDED."name", "nativeName" = EXCLUDED."nativeName",
    "slug" = EXCLUDED."slug", "subtype" = EXCLUDED."subtype",
    "metadata" = EXCLUDED."metadata", "parentId" = EXCLUDED."parentId",
    "sourceFeatureId" = EXCLUDED."sourceFeatureId", "isActive" = true,
    "validTo" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

DO $$
DECLARE loaded_count integer;
BEGIN
    SELECT count(*) INTO loaded_count
    FROM "AdministrativeArea"
    WHERE "sourceId" = 'locsrc_lgd_state_ut_20260830' AND "type" = 'STATE_OR_UT' AND "isActive";
    IF loaded_count <> 36 THEN
        RAISE EXCEPTION 'LGD State/UT registry must contain exactly 36 active rows; found %', loaded_count;
    END IF;
END $$;
