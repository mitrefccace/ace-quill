/* This SELECT WHERE construction means we wont duplicate rows if they already exist */
INSERT INTO `language_code` (code, google, google_translate, azure, azure_translate, watson, watson_translate, aws, aws_translate)
SELECT 'en','en-US','en','en-US','en-US','en-US_BroadbandModel','en','en-US','en'
WHERE (SELECT count(*) from `language_code` where code='en') < 1;

INSERT INTO `language_code` (code, google, google_translate, azure, azure_translate, watson, watson_translate, aws, aws_translate)
SELECT 'es','es-US','es','es-MX','es-MX','es-MX_BroadbandModel','es','es-US','es'
WHERE (SELECT count(*) from `language_code` where code='es') < 1;