
CREATE TABLE IF NOT EXISTS `login_credentials` ( 
  `idlogin_credentials` int(11) NOT NULL AUTO_INCREMENT, 
  `username` varchar(45) DEFAULT NULL, 
  `first_name` varchar(45) DEFAULT NULL, 
  `last_name` varchar(45) DEFAULT NULL, 
  `password` varchar(150) DEFAULT NULL, 
  `role` varchar(45) DEFAULT NULL, 
  `last_login` timestamp NULL DEFAULT NULL, 
  PRIMARY KEY (`idlogin_credentials`), 
  UNIQUE KEY `username_UNIQUE` (`username`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `audio_profiles` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `name` varchar(100) NOT NULL, 
  `description` tinytext, 
  `active` tinyint(4) NOT NULL DEFAULT '1', 
  PRIMARY KEY (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `data_store` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `extension` varchar(45) DEFAULT NULL, 
  `transcript` text, 
  `final` varchar(64) DEFAULT NULL, 
  `timestamp` varchar(64) DEFAULT NULL, 
  `sttEngine` varchar(64) DEFAULT NULL, 
  `research_data_id` int(10) DEFAULT NULL, 
  `raw` mediumtext, 
  `is_iprelay` int(11) DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  KEY `research_data_id` (`research_data_id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `contacts` ( 
  `idcontacts` int(11) NOT NULL AUTO_INCREMENT, 
  `username` varchar(64) DEFAULT NULL, 
  `cellphone` varchar(16) DEFAULT NULL, 
  `workphone` varchar(16) DEFAULT NULL, 
  `homephone` varchar(16) DEFAULT NULL, 
  `faxphone` varchar(16) DEFAULT NULL, 
  `personalemail` varchar(64) DEFAULT NULL, 
  `workemail` varchar(64) DEFAULT NULL, 
  `favorite` tinyint(4) DEFAULT NULL, 
  `extension` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`idcontacts`), 
  UNIQUE KEY `idcontacts` (`idcontacts`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `device_settings` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `extension` smallint(5) DEFAULT NULL, 
  `stt_engine` varchar(45) DEFAULT NULL, 
  `delay` double DEFAULT NULL, 
  `default_device` tinyint(1) DEFAULT '0', 
  `name` varchar(45) DEFAULT NULL, 
  `translation_engine` varchar(10) DEFAULT NULL, 
  `source_language` varchar(10) DEFAULT NULL, 
  `target_language` varchar(10) DEFAULT NULL, 
  `ARIA_settings` varchar(45) DEFAULT NULL, 
  `stt_show_final_caption` tinyint(1) DEFAULT NULL, 
  `tts_engine` varchar(45) DEFAULT NULL, 
  `tts_translate` tinyint(1) DEFAULT NULL, 
  `confidence_show_word` tinyint(1) DEFAULT NULL, 
  `confidence_show_phrase` tinyint(1) DEFAULT NULL, 
  `confidence_upper_lim` smallint(5) DEFAULT NULL, 
  `confidence_lower_lim` smallint(5) DEFAULT NULL, 
  `confidence_upper_color` varchar(45) DEFAULT NULL, 
  `confidence_lower_color` varchar(45) DEFAULT NULL, 
  `confidence_bold` tinyint(1) DEFAULT NULL, 
  `confidence_italicize` tinyint(1) DEFAULT NULL, 
  `confidence_underline` tinyint(1) DEFAULT NULL, 
  `iprelay` tinyint(1) DEFAULT NULL, 
  `iprelay_scenario` varchar(45) DEFAULT NULL, 
  `tts_voice` varchar(45) DEFAULT NULL, 
  `tts_enabled` int(11) DEFAULT NULL, 
  `stt_show_entity_sentiment` varchar(45) DEFAULT NULL, 
  `predefined_id` int(11) DEFAULT NULL, 
  `auto_punctuation` tinyint(1) DEFAULT '0', 
  `speech_detector_sensitivity` double DEFAULT '0.5', 
  `background_audio_suppression` double DEFAULT '0.5', 
  `v2` tinyint(1) DEFAULT '0', 
  `greeting_id` int(11) DEFAULT NULL, 
  `greeting_delay` int(11) DEFAULT '500', 
  `typing_id` int(11) DEFAULT NULL, 
  `typing_repeat` tinyint(1) DEFAULT '0', 
  `typing_repeat_delay` int(11) DEFAULT '500', 
  `greeting_show_transcript` int(11) DEFAULT '1', 
  `typing_show_transcript` int(11) DEFAULT '1', 
  `dropout_outgoing_enabled` int(11) DEFAULT '0', 
  `dropout_outgoing_interval_min` int(11) DEFAULT '2000', 
  `dropout_outgoing_interval_max` int(11) DEFAULT '2000', 
  `dropout_outgoing_length_min` int(11) DEFAULT '100', 
  `dropout_outgoing_length_max` int(11) DEFAULT '100', 
  `dropout_incoming_enabled` tinyint(1) DEFAULT '0', 
  `dropout_incoming_interval_min` int(11) DEFAULT '2000', 
  `dropout_incoming_interval_max` int(11) DEFAULT '2000', 
  `dropout_incoming_length_min` int(11) DEFAULT '100', 
  `dropout_incoming_length_max` int(11) DEFAULT '500', 
  `background_noise_incoming_enabled` tinyint(1) DEFAULT '0', 
  `background_noise_incoming_id` int(11) DEFAULT NULL, 
  `background_noise_outgoing_enabled` tinyint(1) DEFAULT '0', 
  `background_noise_outgoing_id` int(11) DEFAULT NULL, 
  `dual_enabled` int(11) DEFAULT NULL, 
  `caller_confidence_show_word` tinyint(4) DEFAULT NULL, 
  `caller_confidence_show_phrase` tinyint(4) DEFAULT NULL, 
  `caller_confidence_upper_lim` smallint(6) DEFAULT NULL, 
  `caller_confidence_lower_lim` smallint(6) DEFAULT NULL, 
  `caller_confidence_upper_color` varchar(45) DEFAULT NULL, 
  `caller_confidence_lower_color` varchar(45) DEFAULT NULL, 
  `caller_confidence_bold` tinyint(4) DEFAULT NULL, 
  `caller_confidence_italicize` tinyint(4) DEFAULT NULL, 
  `caller_confidence_underline` tinyint(4) DEFAULT NULL, 
  `dual_font_color` varchar(45) DEFAULT NULL, 
  `caller_captions_enabled` int(11) DEFAULT NULL, 
  `stt_dropout_enabled` tinyint(1) DEFAULT '0', 
  `stt_dropout_interval` int(11) DEFAULT '2', 
  `stt_dropout_length_min` int(11) DEFAULT '100', 
  `stt_dropout_length_max` int(11) DEFAULT '200', 
  PRIMARY KEY (`id`), 
  UNIQUE KEY `extension_UNIQUE` (`extension`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `iprelay_scenario` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `name` varchar(256) DEFAULT NULL, 
  `use_count` int(10) DEFAULT NULL, 
  `notes` text, 
  PRIMARY KEY (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `language_code` ( 
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
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `predefined_captions` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `title` varchar(80) NOT NULL, 
  PRIMARY KEY (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `registration_data` ( 
  `extension` smallint(5) NOT NULL, 
  `build_number` varchar(64) DEFAULT NULL, 
  `git_commit` varchar(64) DEFAULT NULL, 
  `device_id` varchar(256) DEFAULT NULL, 
  PRIMARY KEY (`extension`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `research_data` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `device_id` varchar(256) NOT NULL, 
  `extension` smallint(5) NOT NULL, 
  `src_channel` varchar(32) NOT NULL, 
  `dest_channel` varchar(32) NOT NULL, 
  `call_start` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  `unique_id` varchar(32) NOT NULL, 
  `dest_phone_number` varchar(16) NOT NULL, 
  `stt_engine` varchar(45) NOT NULL, 
  `call_accuracy` tinyint(2) unsigned NOT NULL, 
  `added_delay` tinyint(2) unsigned NOT NULL, 
  `transcription_file_path` varchar(256) NOT NULL, 
  `transcription_file` varchar(256) NOT NULL, 
  `audio_file_path` varchar(256) NOT NULL, 
  `audio_file` varchar(256) NOT NULL, 
  `video_file` varchar(256) DEFAULT NULL, 
  `call_end` timestamp NULL DEFAULT NULL, 
  `call_duration` int(11) unsigned DEFAULT NULL, 
  `build_number` varchar(256) DEFAULT NULL, 
  `git_commit` varchar(256) DEFAULT NULL, 
  `scenario_number` tinyint(2) DEFAULT NULL, 
  `notes` text, 
  `mobizen_notes` text, 
  `translation_engine` varchar(45) DEFAULT NULL, 
  `source_language` varchar(45) DEFAULT NULL, 
  `target_language` varchar(45) DEFAULT NULL, 
  `tts_engine` varchar(45) DEFAULT NULL, 
  `is_iprelay` int(11) DEFAULT NULL, 
  `predefined_id` int(11) DEFAULT NULL, 
  `custom_name` varchar(255) DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  UNIQUE KEY `idnew_table_UNIQUE` (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `scenario` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `transcript` text, 
  `scenario_name` varchar(64) DEFAULT NULL, 
  `audio_file` varchar(64) DEFAULT NULL, 
  `audio_file_path` varchar(64) DEFAULT NULL, 
  PRIMARY KEY (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `sessions` ( 
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, 
  `expires` int(11) unsigned NOT NULL, 
  `data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin, 
  PRIMARY KEY (`session_id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS  `audible_cues` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `title` varchar(100) DEFAULT NULL, 
  `status` varchar(64) DEFAULT NULL, 
  `date` varchar(64) DEFAULT NULL, 
  `user_id` int(11) DEFAULT NULL, 
  `transcript` text, 
  `file_location` varchar(256) DEFAULT NULL, 
  `audio_file_name` varchar(100) DEFAULT NULL, 
  `type` varchar(64) DEFAULT NULL, 
  `duration` int(11) DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  KEY `user_id` (`user_id`), 
  CONSTRAINT `audible_cues_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `login_credentials` (`idlogin_credentials`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `audio_file_transcribe` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `title` varchar(100) DEFAULT NULL, 
  `status` varchar(64) DEFAULT NULL, 
  `date` varchar(64) DEFAULT NULL, 
  `user_id` int(11) DEFAULT NULL, 
  `file_location` varchar(256) DEFAULT NULL, 
  `audio_file_name` varchar(100) DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  KEY `user_id` (`user_id`), 
  CONSTRAINT `audio_file_transcribe_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `login_credentials` (`idlogin_credentials`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `audio_filters` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `profile_id` int(11) DEFAULT NULL, 
  `profile_order` tinyint(4) DEFAULT NULL, 
  `name` varchar(100) NOT NULL, 
  `gain` tinyint(4) DEFAULT NULL, 
  `frequency` int(11) DEFAULT NULL, 
  `type` varchar(20) DEFAULT 'lowpass', 
  `rolloff` tinyint(4) DEFAULT NULL, 
  `q_value` decimal(4,2) DEFAULT NULL, 
  `pitchshift` tinyint(4) DEFAULT '0', 
  PRIMARY KEY (`id`), 
  KEY `fk_audio_profile_idx` (`profile_id`), 
  CONSTRAINT `fk_audio_profile` FOREIGN KEY (`profile_id`) REFERENCES `audio_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `iprelay_log` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `fk_call_id` int(10) unsigned DEFAULT NULL, 
  `is_dut` tinyint(4) NOT NULL DEFAULT '0', 
  `text` text, 
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`), 
  KEY `fk_call_id_idx` (`fk_call_id`), 
  CONSTRAINT `fk_call_id` FOREIGN KEY (`fk_call_id`) REFERENCES `research_data` (`id`) ON DELETE CASCADE ON UPDATE CASCADE 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `iprelay_recordings` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `source` varchar(45) NOT NULL, 
  `filepath` varchar(300) NOT NULL, 
  `fk_research_data_id` int(10) unsigned DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  KEY `fk_researchdata_idx` (`fk_research_data_id`), 
  CONSTRAINT `fk_researchdata` FOREIGN KEY (`fk_research_data_id`) REFERENCES `research_data` (`id`) ON DELETE CASCADE ON UPDATE CASCADE 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `iprelay_scenario_content` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `iprelay_scenario_id` int(10) unsigned DEFAULT NULL, 
  `convoOrder` int(10) unsigned DEFAULT NULL, 
  `bubbleText` text, 
  `rawText` text, 
  `audioFilePath` varchar(256) DEFAULT NULL, 
  `isDUT` tinyint(1) DEFAULT NULL, 
  PRIMARY KEY (`id`), 
  KEY `iprelay_scenario_content_ibfk_1` (`iprelay_scenario_id`), 
  CONSTRAINT `iprelay_scenario_content_ibfk_1` FOREIGN KEY (`iprelay_scenario_id`) REFERENCES `iprelay_scenario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `predefined_captions_data` ( 
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `fk_id` int(11) DEFAULT NULL, 
  `word` varchar(45) NOT NULL, 
  `ms` int(11) DEFAULT NULL, 
  `final` varchar(45) DEFAULT '0', 
  `phrase_id` int(11) NOT NULL, 
  PRIMARY KEY (`id`), 
  KEY `fk_predefined_captions_idx` (`fk_id`), 
  CONSTRAINT `fk_predefined_captions` FOREIGN KEY (`fk_id`) REFERENCES `predefined_captions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `translation_data` ( 
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT, 
  `extension` varchar(45) DEFAULT NULL, 
  `translation` text, 
  `timestamp` varchar(64) DEFAULT NULL, 
  `engine` varchar(64) DEFAULT NULL, 
  `msgid` varchar(64) DEFAULT NULL, 
  `research_data_id` int(10) unsigned DEFAULT NULL, 
  `preTranslation` text, 
  PRIMARY KEY (`id`), 
  KEY `research_data_id` (`research_data_id`), 
  CONSTRAINT `translation_data_ibfk_1` FOREIGN KEY (`research_data_id`) REFERENCES `research_data` (`id`) 
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
