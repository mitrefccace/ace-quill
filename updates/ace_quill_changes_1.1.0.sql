INSERT INTO language_code(code,google, google_translate,azure, azure_translate,watson, watson_translate, aws, aws_translate)
VALUES('en', 'en-US', 'en', 'en-US', 'en-US', 'en-US_BroadbandModel', 'en', 'en-US', 'en'),
('es', 'es-US', 'es', 'es-MX', 'es-MX', 'es-MX_BroadbandModel', 'es', 'es-US', 'es');

ALTER TABLE device_settings
ADD COLUMN `stt_show_entity_sentiment` varchar(45);

ALTER TABLE data_store
ADD COLUMN `is_iprelay` int(11) DEFAULT NULL;

ALTER TABLE research_data
ADD COLUMN `is_iprelay` int(11) DEFAULT NULL;

CREATE TABLE `advanced_controls` (
  `extension` smallint(5) NOT NULL,
  `stt_engine` varchar(45) DEFAULT NULL,
  `stt_callee_language` varchar(45) DEFAULT NULL,
  `stt_show_final_caption` tinyint(1) DEFAULT NULL,
  `stt_delay` smallint(2) DEFAULT NULL,
  `translation_engine` varchar(45) DEFAULT NULL,
  `translation_callee_language` varchar(45) DEFAULT NULL,
  `tts_engine` varchar(45) DEFAULT NULL,
  `tts_translate` tinyint(1) DEFAULT NULL,
  `aria_settings` varchar(64) DEFAULT NULL,
  `confidence_show_word` tinyint(1) DEFAULT NULL,
  `confidence_show_phrase` tinyint(1) DEFAULT NULL,
  `confidence_upper_lim` smallint(5) DEFAULT NULL,
  `confidence_lower_lim` smallint(5) DEFAULT NULL,
  `confidence_bold` tinyint(1) DEFAULT NULL,
  `confidence_italicize` tinyint(1) DEFAULT NULL,
  `confidence_underline` tinyint(1) DEFAULT NULL,
  `iprelay` tinyint(1) DEFAULT NULL,
  `iprelay_scenario` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
