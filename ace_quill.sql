-- MySQL dump 10.13  Distrib 8.0.27, for macos11 (x86_64)
--
-- Host: localhost    Database: ace_quill
-- ------------------------------------------------------
-- Server version	5.7.35

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audio_filters`
--

DROP TABLE IF EXISTS `audio_filters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_filters` (
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audio_profiles`
--

DROP TABLE IF EXISTS `audio_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` tinytext,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contacts` (
  `idcontacts` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(64) DEFAULT NULL,
  `cellphone` varchar(16) DEFAULT NULL,
  `workphone` varchar(16) DEFAULT NULL,
  `homephone` varchar(16) DEFAULT NULL,
  `faxphone` varchar(16) DEFAULT NULL,
  `personalemail` varchar(64) DEFAULT NULL,
  `workemail` varchar(64) DEFAULT NULL,
  `favorite` tinyint(4) DEFAULT NULL,
  `extension` smallint(5) DEFAULT NULL,
  PRIMARY KEY (`idcontacts`),
  UNIQUE KEY `idcontacts` (`idcontacts`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `data_store`
--

DROP TABLE IF EXISTS `data_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_store` (
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
) ENGINE=InnoDB AUTO_INCREMENT=213246 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_settings`
--

DROP TABLE IF EXISTS `device_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `extension` smallint(5) DEFAULT NULL,
  `stt_engine` varchar(45) DEFAULT NULL,
  `delay` smallint(2) DEFAULT NULL,
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `extension_UNIQUE` (`extension`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `device_settings` WRITE;
/*!40000 ALTER TABLE `device_settings` DISABLE KEYS */;
INSERT INTO `device_settings` VALUES (47,5001,'AZURE',0,0,'terminal 01',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(48,5002,'AZURE',0,0,'terminal 02',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(49,5003,'AZURE',0,0,'terminal 03',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(50,5004,'AZURE',0,0,'terminal 04',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(51,5005,'AZURE',0,0,'terminal 05',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(52,5006,'AZURE',0,0,'terminal 06',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(53,5007,'AZURE',0,0,'terminal 07',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(54,5008,'AZURE',0,0,'terminal 08',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(55,5009,'AZURE',0,0,'terminal 09',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(56,5010,'AZURE',0,0,'terminal 10',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(57,5011,'AZURE',0,0,'terminal 11',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(58,5012,'AZURE',0,0,'terminal 12',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(59,5013,'AZURE',0,0,'terminal 13',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(60,5014,'AZURE',0,0,'terminal 14',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(61,5015,'AZURE',0,0,'terminal 15',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(62,5016,'AZURE',0,0,'terminal 16',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(63,5017,'AZURE',0,0,'terminal 17',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(64,5018,'AZURE',0,0,'terminal 18',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(65,5019,'AZURE',0,0,'terminal 19',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(66,5020,'AZURE',0,0,'terminal 20',NULL,NULL,'NONE','en','en',NULL,NULL,NULL,'None',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `device_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `iprelay_log`
--

DROP TABLE IF EXISTS `iprelay_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iprelay_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fk_call_id` int(10) unsigned DEFAULT NULL,
  `is_dut` tinyint(4) NOT NULL DEFAULT '0',
  `text` text,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_call_id_idx` (`fk_call_id`),
  CONSTRAINT `fk_call_id` FOREIGN KEY (`fk_call_id`) REFERENCES `research_data` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iprelay_recordings`
--

DROP TABLE IF EXISTS `iprelay_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iprelay_recordings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source` varchar(45) NOT NULL,
  `filepath` varchar(300) NOT NULL,
  `fk_research_data_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_researchdata_idx` (`fk_research_data_id`),
  CONSTRAINT `fk_researchdata` FOREIGN KEY (`fk_research_data_id`) REFERENCES `research_data` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iprelay_scenario`
--

DROP TABLE IF EXISTS `iprelay_scenario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iprelay_scenario` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(256) DEFAULT NULL,
  `use_count` smallint(5) DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iprelay_scenario_content`
--

DROP TABLE IF EXISTS `iprelay_scenario_content`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iprelay_scenario_content` (
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
) ENGINE=InnoDB AUTO_INCREMENT=713 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `language_code`
--

DROP TABLE IF EXISTS `language_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `language_code` WRITE;
/*!40000 ALTER TABLE `language_code` DISABLE KEYS */;
INSERT INTO language_code(code,google, google_translate,azure, azure_translate,watson, watson_translate, aws, aws_translate)
VALUES('en', 'en-US', 'en', 'en-US', 'en-US', 'en-US_BroadbandModel', 'en', 'en-US', 'en'),
('es', 'es-US', 'es', 'es-MX', 'es-MX', 'es-MX_BroadbandModel', 'es', 'es-US', 'es');
/*!40000 ALTER TABLE `language_code` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_credentials`
--

DROP TABLE IF EXISTS `login_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_credentials` (
  `idlogin_credentials` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(45) DEFAULT NULL,
  `first_name` varchar(45) DEFAULT NULL,
  `last_name` varchar(45) DEFAULT NULL,
  `password` varchar(150) DEFAULT NULL,
  `role` varchar(45) DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`idlogin_credentials`),
  UNIQUE KEY `username_UNIQUE` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `predefined_captions`
--

DROP TABLE IF EXISTS `predefined_captions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `predefined_captions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(80) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `predefined_captions_data`
--

DROP TABLE IF EXISTS `predefined_captions_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `registration_data`
--

DROP TABLE IF EXISTS `registration_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registration_data` (
  `extension` smallint(5) NOT NULL,
  `build_number` varchar(64) DEFAULT NULL,
  `git_commit` varchar(64) DEFAULT NULL,
  `device_id` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `research_data`
--

DROP TABLE IF EXISTS `research_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `research_data` (
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
  `source_language` varchar(10) DEFAULT NULL,
  `target_language` varchar(10) DEFAULT NULL,
  `tts_engine` varchar(45) DEFAULT NULL,
  `is_iprelay` int(11) DEFAULT NULL,
  `predefined_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idnew_table_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2960 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scenario`
--

DROP TABLE IF EXISTS `scenario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scenario` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `transcript` text,
  `scenario_name` varchar(64) DEFAULT NULL,
  `audio_file` varchar(64) DEFAULT NULL,
  `audio_file_path` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `translation_data`
--

DROP TABLE IF EXISTS `translation_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `translation_data` (
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
) ENGINE=InnoDB AUTO_INCREMENT=1066 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2022-06-23 15:11:50
