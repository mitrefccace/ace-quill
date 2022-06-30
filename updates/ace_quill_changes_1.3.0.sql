DROP table groups;

DROP table advanced_controls;

DROP table device_map;

CREATE TABLE `audio_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` tinytext,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
)

CREATE TABLE `audio_filters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `profile_id` int(11) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `profile_order` tinyint(4) DEFAULT NULL,
  `gain` tinyint(4) DEFAULT NULL,
  `frequency` int(11) DEFAULT NULL,
  `type` varchar(20) DEFAULT 'lowpass',
  `rolloff` tinyint(4) DEFAULT NULL,
  `q_value` decimal(4,2) DEFAULT NULL,
  `pitchshift` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_audio_profile_idx` (`profile_id`),
  CONSTRAINT `fk_audio_profile` FOREIGN KEY (`profile_id`) REFERENCES `audio_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE `ace_quill`.`contacts` 
CHANGE COLUMN `extension` `extension` VARCHAR(10) NULL DEFAULT NULL ;

ALTER TABLE `ace_quill`.`device_settings` 
CHANGE COLUMN `groups` `groups` VARCHAR(11) NULL DEFAULT NULL
CHANGE COLUMN `translation_engine` `translation_engine` VARCHAR(45) NULL DEFAULT NULL
ADD COLUMN `predefined_id` int(11) DEFAULT NULL;

ALTER TABLE `ace_quill`.`iprelay_scenario` 
CHANGE COLUMN `name` `name` VARCHAR(64) NULL DEFAULT NULL
CHANGE COLUMN `use_count` `use_count` INT(10) NULL DEFAULT NULL;

CREATE TABLE `language_code` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(256) DEFAULT NULL,
  `google` varchar(256) DEFAULT NULL,
  `google_translate` varchar(256) DEFAULT NULL,
  `azure` varchar(256) DEFAULT NULL,
  `azure_translate` varchar(256) DEFAULT NULL,
  `watson` varchar(256) DEFAULT NULL,
  `watson_translate` varchar(256) DEFAULT NULL,
  `aws` varchar(256) DEFAULT NULL,
  `aws_translate` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

INSERT INTO language_code(code,google, google_translate,azure, azure_translate,watson, watson_translate, aws, aws_translate)
VALUES('en', 'en-US', 'en', 'en-US', 'en-US', 'en-US_BroadbandModel', 'en', 'en-US', 'en'),
('es', 'es-US', 'es', 'es-MX', 'es-MX', 'es-MX_BroadbandModel', 'es', 'es-US', 'es');

ALTER TABLE `ace_quill`.`login_credentials` 
DROP COLUMN `groups`;

CREATE TABLE `predefined_captions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(80) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `predefined_captions_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fk_id` int(11) DEFAULT NULL,
  `word` varchar(45) NOT NULL,
  `ms` int(11) DEFAULT NULL,
  `final` varchar(45) DEFAULT '0',
  `phrase_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_predefined_captions_idx` (`fk_id`),
  CONSTRAINT `fk_predefined_captions` FOREIGN KEY (`fk_id`) REFERENCES `predefined_captions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
)

ALTER TABLE `ace_quill`.`research_data` 
CHANGE COLUMN `source_language` `source_language` VARCHAR(45) NULL DEFAULT NULL
CHANGE COLUMN `target_language` `target_language` VARCHAR(45) NULL DEFAULT NULL
ADD COLUMN `predefined_id` int(11) DEFAULT NULL;

ALTER TABLE `ace_quill`.`device_settings` 
DROP COLUMN `groups`,
DROP COLUMN `group_id`;

ALTER TABLE `ace_quill`.`login_credentials` 
DROP COLUMN `groups`,
DROP COLUMN `group_id`;
